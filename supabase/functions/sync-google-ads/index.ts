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
  const encryptionKey = Deno.env.get("INTEGRATIONS_ENCRYPTION_KEY")!;

  let userId: string | null = null;
  let triggeredBy: "manual" | "cron" = "manual";

  try {
    const body = (await req.json().catch(() => ({}))) as SyncRequest & { user_id?: string };
    triggeredBy = body.triggered_by ?? "manual";

    // Auth: either user JWT (manual) or service-role with explicit user_id (cron)
    const authHeader = req.headers.get("Authorization");
    if (triggeredBy === "cron" && body.user_id) {
      // Verify caller is using service role
      if (!authHeader?.includes(serviceKey.slice(0, 20))) {
        // soft-check; cron job calls with anon key + user_id won't be allowed
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader ?? "" } },
        });
        const { data: claims } = await userClient.auth.getClaims();
        if (!claims?.claims?.sub) throw new Error("Unauthorized cron call");
        userId = claims.claims.sub;
      } else {
        userId = body.user_id;
      }
    } else {
      if (!authHeader?.startsWith("Bearer ")) throw new Error("Missing Authorization");
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims, error: claimsErr } = await userClient.auth.getClaims();
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
      _encryption_key: encryptionKey,
    });
    if (tokenErr) throw new Error(`Token fetch failed: ${tokenErr.message}`);
    const tokens = (tokensRows as any[])?.[0];
    if (!tokens?.refresh_token) throw new Error("Google Ads not connected (no refresh token)");

    // Refresh access token (always use fresh)
    const refreshed = await refreshAccessToken(tokens.refresh_token, clientId, clientSecret);
    const accessToken = refreshed.access_token;

    // Get accessible customer
    let accountId: string = tokens.account_id || "";
    if (!accountId) {
      const listRes = await fetch(
        "https://googleads.googleapis.com/v18/customers:listAccessibleCustomers",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "developer-token": developerToken,
          },
        }
      );
      const listData = await listRes.json();
      if (!listRes.ok) throw new Error(`List customers failed: ${JSON.stringify(listData)}`);
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
      `https://googleads.googleapis.com/v18/customers/${accountId}/googleAds:searchStream`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": developerToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: gaql }),
      }
    );
    const reportData = await reportRes.json();
    if (!reportRes.ok) {
      throw new Error(`Google Ads API error [${reportRes.status}]: ${JSON.stringify(reportData)}`);
    }

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
