import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncRequest {
  date_range_start?: string; // YYYY-MM-DD
  date_range_end?: string;   // YYYY-MM-DD
  triggered_by?: "manual" | "cron";
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Token refresh failed [${res.status}]: ${txt}`);
  }
  return await res.json() as { access_token: string; expires_in: number };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const clientId = Deno.env.get("GOOGLE_ADS_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_ADS_CLIENT_SECRET")!;
  const developerToken = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN")!;

  let userId: string | null = null;
  let triggeredBy: "manual" | "cron" = "manual";

  try {
    const body = (await req.json().catch(() => ({}))) as SyncRequest & { user_id?: string };
    triggeredBy = body.triggered_by ?? "manual";

    // Auth: either user JWT (manual) or service-role with explicit user_id (cron)
    const authHeader = req.headers.get("Authorization");
    if (triggeredBy === "cron" && body.user_id) {
      // SECURITY: cron path must be invoked with the exact service-role key.
      // The previous substring check could be partially spoofed and the fallback
      // silently authenticated the caller (not the body.user_id), masking misuse.
      const expected = `Bearer ${serviceKey}`;
      if (!authHeader || authHeader !== expected) {
        throw new Error("Unauthorized cron call");
      }
      userId = body.user_id;
    } else {
      if (!authHeader?.startsWith("Bearer ")) throw new Error("Missing Authorization");
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
      if (claimsErr || !claims?.claims?.sub) throw new Error("Unauthorized");
      userId = claims.claims.sub;
    }

    // Date range defaults: last 30 days
    const today = new Date();
    const start = body.date_range_start ?? isoDate(new Date(today.getTime() - 30 * 86400000));
    const end = body.date_range_end ?? isoDate(today);

    const admin = createClient(supabaseUrl, serviceKey);

    // Fetch tokens
    const { data: tokensRows, error: tokenErr } = await admin.rpc("get_integration_tokens", {
      _user_id: userId,
      _provider: "google_ads",
    });
    if (tokenErr) throw new Error(`Token fetch failed: ${tokenErr.message}`);
    const tokens = (tokensRows as any[])?.[0];
    if (!tokens?.refresh_token) throw new Error("Google Ads not connected (no refresh token)");

    // Refresh access token (always use fresh)
    const refreshed = await refreshAccessToken(tokens.refresh_token, clientId, clientSecret);
    const accessToken = refreshed.access_token;

    // Get accessible customer
    let storedAccountId: string = tokens.account_id || "";
    let accountId = "";
    let loginCustomerId = "";
    if (storedAccountId.includes(":")) {
      const [cid, parent] = storedAccountId.split(":");
      accountId = cid;
      loginCustomerId = parent;
    } else {
      accountId = storedAccountId;
    }
    if (!accountId) {
      const listRes = await fetch(
        "https://googleads.googleapis.com/v21/customers:listAccessibleCustomers",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "developer-token": developerToken,
          },
        }
      );
      const listText = await listRes.text();
      if (!listRes.ok) {
        throw new Error(`List customers failed [${listRes.status}]: ${listText.slice(0, 500)}`);
      }
      let listData: any;
      try { listData = JSON.parse(listText); }
      catch { throw new Error(`Google Ads returned non-JSON (likely invalid developer token or API not enabled): ${listText.slice(0, 300)}`); }
      const first = listData.resourceNames?.[0];
      if (!first) throw new Error("No accessible Google Ads accounts");
      accountId = first.replace("customers/", "");
    }

    // Run GAQL query
    const gaql = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign_budget.amount_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value,
        metrics.ctr,
        metrics.average_cpc
      FROM campaign
      WHERE segments.date BETWEEN '${start}' AND '${end}'
    `;

    const reportRes = await fetch(
      `https://googleads.googleapis.com/v21/customers/${accountId}/googleAds:searchStream`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": developerToken,
          ...(loginCustomerId ? { "login-customer-id": loginCustomerId } : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: gaql }),
      }
    );
    const reportText = await reportRes.text();
    if (!reportRes.ok) {
      throw new Error(`Google Ads API error [${reportRes.status}]: ${reportText.slice(0, 500)}`);
    }
    let reportData: any;
    try { reportData = JSON.parse(reportText); }
    catch { throw new Error(`Google Ads returned non-JSON (likely invalid developer token or API not enabled): ${reportText.slice(0, 300)}`); }

    // searchStream returns array of result chunks
    const chunks = Array.isArray(reportData) ? reportData : [reportData];
    const aggregated = new Map<string, any>();

    for (const chunk of chunks) {
      const results = chunk.results ?? [];
      for (const row of results) {
        const cid = String(row.campaign?.id ?? "");
        if (!cid) continue;
        const existing = aggregated.get(cid) ?? {
          campaign_id: cid,
          campaign_name: row.campaign?.name ?? "(unnamed)",
          status: row.campaign?.status ?? null,
          advertising_channel_type: row.campaign?.advertisingChannelType ?? null,
          daily_budget_micros: row.campaignBudget?.amountMicros ? Number(row.campaignBudget.amountMicros) : null,
          impressions: 0,
          clicks: 0,
          cost_micros: 0,
          conversions: 0,
          conversions_value: 0,
          ctr_sum: 0,
          ctr_count: 0,
          cpc_sum: 0,
          cpc_count: 0,
        };
        const m = row.metrics ?? {};
        existing.impressions += Number(m.impressions ?? 0);
        existing.clicks += Number(m.clicks ?? 0);
        existing.cost_micros += Number(m.costMicros ?? 0);
        existing.conversions += Number(m.conversions ?? 0);
        existing.conversions_value += Number(m.conversionsValue ?? 0);
        if (m.ctr != null) { existing.ctr_sum += Number(m.ctr); existing.ctr_count += 1; }
        if (m.averageCpc != null) { existing.cpc_sum += Number(m.averageCpc); existing.cpc_count += 1; }
        aggregated.set(cid, existing);
      }
    }

    const rowsToUpsert = Array.from(aggregated.values()).map((c: any) => ({
      user_id: userId,
      google_account_id: accountId,
      campaign_id: c.campaign_id,
      campaign_name: c.campaign_name,
      status: c.status,
      advertising_channel_type: c.advertising_channel_type,
      daily_budget_micros: c.daily_budget_micros,
      impressions: c.impressions,
      clicks: c.clicks,
      cost_micros: c.cost_micros,
      conversions: c.conversions,
      conversions_value: c.conversions_value,
      ctr: c.ctr_count ? c.ctr_sum / c.ctr_count : 0,
      average_cpc_micros: c.cpc_count ? Math.round(c.cpc_sum / c.cpc_count) : 0,
      date_range_start: start,
      date_range_end: end,
      last_synced_at: new Date().toISOString(),
    }));

    if (rowsToUpsert.length > 0) {
      const { error: upErr } = await admin
        .from("google_ads_campaigns")
        .upsert(rowsToUpsert, {
          onConflict: "user_id,google_account_id,campaign_id,date_range_start,date_range_end",
        });
      if (upErr) throw new Error(`Upsert failed: ${upErr.message}`);
    }

    // ---- Auto-import into the org-wide `campaigns` table ----
    // Find the user's organization (first active membership).
    let importedCount = 0;
    try {
      const { data: memberRows } = await admin
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", userId)
        .eq("status", "active")
        .limit(1);
      const orgId = memberRows?.[0]?.organization_id;

      if (orgId && rowsToUpsert.length > 0) {
        // Resolve a client to attach the campaigns to, based on the Google Ads account name.
        // 1) Use account_name from stored integration tokens (descriptive name picked by user).
        // 2) Try to find an existing client in the org with the same name (case-insensitive).
        // 3) If none, create one.
        // We only set client_id when creating new campaign rows — manual reassignments are preserved.
        const accountName: string = (tokens.account_name ?? "").toString().trim()
          || `Google Ads ${accountId}`;

        let clientId: string | null = null;
        const { data: existingClient } = await admin
          .from("clients")
          .select("id")
          .eq("organization_id", orgId)
          .ilike("name", accountName)
          .limit(1)
          .maybeSingle();
        if (existingClient?.id) {
          clientId = existingClient.id as string;
        } else {
          const { data: newClient, error: newClientErr } = await admin
            .from("clients")
            .insert({
              organization_id: orgId,
              name: accountName,
              industry: "Google Ads",
              status: "active",
            })
            .select("id")
            .single();
          if (newClientErr) {
            console.error("Client create failed:", newClientErr.message);
          } else {
            clientId = newClient?.id ?? null;
          }
        }

        // Preserve any manual client_id assignments already on existing campaign rows.
        const externalIds = rowsToUpsert.map((r: any) => `${r.google_account_id}:${r.campaign_id}`);
        const { data: existingCampaigns } = await admin
          .from("campaigns")
          .select("external_id, client_id")
          .eq("organization_id", orgId)
          .eq("external_source", "google_ads")
          .in("external_id", externalIds);
        const existingClientByExt = new Map<string, string | null>(
          (existingCampaigns ?? []).map((c: any) => [c.external_id, c.client_id])
        );

        const platformMap: Record<string, string> = {
          SEARCH: "Google Search",
          DISPLAY: "Google Display",
          VIDEO: "YouTube",
          SHOPPING: "Google Shopping",
          PERFORMANCE_MAX: "Performance Max",
          DEMAND_GEN: "Demand Gen",
        };
        const statusMap = (s: string | null) => {
          if (!s) return "Active";
          if (s === "ENABLED") return "Active";
          if (s === "PAUSED") return "Paused";
          if (s === "REMOVED") return "Ended";
          return "Active";
        };
        const campaignsImport = rowsToUpsert.map((r: any) => {
          const extId = `${r.google_account_id}:${r.campaign_id}`;
          const preservedClientId = existingClientByExt.has(extId)
            ? existingClientByExt.get(extId) ?? clientId
            : clientId;
          return {
            organization_id: orgId,
            external_source: "google_ads",
            external_id: extId,
            client_id: preservedClientId,
            name: r.campaign_name,
            platform: platformMap[r.advertising_channel_type ?? ""] ?? "Google Ads",
            status: statusMap(r.status),
            objective: "leads",
            budget: r.daily_budget_micros ? Number(r.daily_budget_micros) / 1_000_000 : 0,
            spend: r.cost_micros ? Number(r.cost_micros) / 1_000_000 : 0,
            clicks: Number(r.clicks) || 0,
            impressions: Number(r.impressions) || 0,
            conversions: Math.round(Number(r.conversions) || 0),
            leads: Math.round(Number(r.conversions) || 0),
            start_date: r.date_range_start,
            end_date: r.date_range_end,
          };
        });

        const { error: importErr } = await admin
          .from("campaigns")
          .upsert(campaignsImport, { onConflict: "organization_id,external_source,external_id" });
        if (importErr) {
          console.error("Campaigns import failed:", importErr.message);
        } else {
          importedCount = campaignsImport.length;
        }
      }
    } catch (e) {
      console.error("Campaigns import error:", e);
    }

    await admin.from("google_ads_sync_log").insert({
      user_id: userId,
      google_account_id: accountId,
      status: "success",
      campaigns_synced: rowsToUpsert.length,
      date_range_start: start,
      date_range_end: end,
      triggered_by: triggeredBy,
    });

    return new Response(
      JSON.stringify({
        success: true,
        campaigns_synced: rowsToUpsert.length,
        campaigns_imported: importedCount,
        account_id: accountId,
        date_range: { start, end },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("sync-google-ads error:", message);

    if (userId) {
      try {
        const admin = createClient(supabaseUrl, serviceKey);
        await admin.from("google_ads_sync_log").insert({
          user_id: userId,
          status: "error",
          error_message: message,
          triggered_by: triggeredBy,
        });
      } catch (_) { /* ignore */ }
    }

    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
