// Sync Google Ads campaigns for the authenticated user.
// - Refreshes access token from the encrypted refresh_token if expired.
// - Discovers accessible customers; expands manager (MCC) accounts to their leaf children.
// - For each leaf account, pulls campaign performance for the requested date range.
// - Upserts into google_ads_campaigns and mirrors into org-wide clients + campaigns.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GADS_VERSION = "v21";

interface SyncRequest {
  date_range_start?: string;
  date_range_end?: string;
  triggered_by?: "manual" | "cron";
  user_id?: string;
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

async function parseJsonSafe(res: Response, label: string): Promise<any> {
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { throw new Error(`${label} non-JSON [${res.status}]: ${text.slice(0, 300)}`); }
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_ADS_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_ADS_CLIENT_SECRET")!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json = await parseJsonSafe(res, "Token refresh");
  if (!res.ok || !json.access_token) {
    throw new Error(`Token refresh failed: ${json.error_description ?? json.error ?? "unknown"}`);
  }
  return json.access_token as string;
}

async function listAccessibleCustomers(accessToken: string, devToken: string): Promise<string[]> {
  const res = await fetch(
    `https://googleads.googleapis.com/${GADS_VERSION}/customers:listAccessibleCustomers`,
    { headers: { Authorization: `Bearer ${accessToken}`, "developer-token": devToken } },
  );
  const data = await parseJsonSafe(res, "listAccessibleCustomers");
  if (!res.ok) throw new Error(`listAccessibleCustomers [${res.status}]: ${JSON.stringify(data).slice(0, 300)}`);
  const names: string[] = data.resourceNames ?? [];
  return names.map((n) => n.replace("customers/", ""));
}

async function gaqlSearch<T = Record<string, unknown>>(
  accessToken: string, devToken: string, customerId: string, query: string, loginCustomerId?: string,
): Promise<T[]> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": devToken,
    "Content-Type": "application/json",
  };
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;

  const res = await fetch(
    `https://googleads.googleapis.com/${GADS_VERSION}/customers/${customerId}/googleAds:searchStream`,
    { method: "POST", headers, body: JSON.stringify({ query }) },
  );
  const data = await parseJsonSafe(res, "searchStream");
  if (!res.ok) throw new Error(`searchStream [${res.status}]: ${JSON.stringify(data).slice(0, 300)}`);
  const chunks = Array.isArray(data) ? data : [data];
  const out: T[] = [];
  for (const c of chunks) for (const r of (c.results ?? [])) out.push(r as T);
  return out;
}

interface CampaignRow {
  customer?: { id?: string; descriptiveName?: string; currencyCode?: string };
  campaign: { id: string; name: string; status?: string; advertisingChannelType?: string };
  campaignBudget?: { amountMicros?: string };
  metrics?: {
    impressions?: string; clicks?: string; costMicros?: string;
    conversions?: number; conversionsValue?: number; ctr?: number;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const devToken = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN")!;

  let userId: string | null = null;
  let triggeredBy: "manual" | "cron" = "manual";

  try {
    if (!devToken) throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN not configured");

    const body = (await req.json().catch(() => ({}))) as SyncRequest;
    triggeredBy = body.triggered_by ?? "manual";

    const authHeader = req.headers.get("Authorization");
    if (triggeredBy === "cron" && body.user_id) {
      if (!authHeader || authHeader !== `Bearer ${serviceKey}`) throw new Error("Unauthorized cron call");
      userId = body.user_id;
    } else {
      if (!authHeader?.startsWith("Bearer ")) throw new Error("Missing Authorization");
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: u, error: uErr } = await userClient.auth.getUser();
      if (uErr || !u?.user?.id) throw new Error("Unauthorized");
      userId = u.user.id;
    }

    const today = new Date();
    const start = body.date_range_start ?? isoDate(new Date(today.getTime() - 30 * 86400000));
    const end = body.date_range_end ?? isoDate(today);

    const admin = createClient(supabaseUrl, serviceKey);

    // Load tokens (encrypted in DB, returned decrypted via SECURITY DEFINER RPC).
    const { data: tokenRows, error: tokenErr } = await admin.rpc("get_integration_tokens", {
      _user_id: userId, _provider: "google_ads",
    });
    if (tokenErr) throw new Error(`Token fetch failed: ${tokenErr.message}`);
    const tokens = (tokenRows as Array<{
      access_token: string; refresh_token: string | null;
      token_expires_at: string | null; account_name: string | null;
    }>)?.[0];
    if (!tokens?.refresh_token) throw new Error("Google Ads not connected — reconnect required");

    // Always refresh: access tokens are short-lived and often stale in DB.
    const accessToken = await refreshAccessToken(tokens.refresh_token);
    await admin.rpc("set_integration_tokens", {
      _user_id: userId, _provider: "google_ads",
      _access_token: accessToken, _refresh_token: tokens.refresh_token,
      _account_id: "", _account_name: tokens.account_name ?? "Google Ads",
      _token_expires_at: new Date(Date.now() + 3300 * 1000).toISOString(),
    });

    const topLevel = await listAccessibleCustomers(accessToken, devToken);
    if (topLevel.length === 0) throw new Error("No accessible Google Ads accounts");

    let totalSynced = 0;
    const syncedAccountIds = new Set<string>();

    // Look up user's org id once for mirroring.
    const { data: memberRow } = await admin
      .from("organization_members").select("organization_id")
      .eq("user_id", userId).eq("status", "active").limit(1).maybeSingle();
    const orgId = memberRow?.organization_id as string | undefined;

    // Discover all leaves across top-level accounts in parallel.
    const discoverAll = await Promise.all(topLevel.map(async (topId) => {
      let leaves: { id: string; login: string }[] = [];
      try {
        const custRows = await gaqlSearch<{ customer: { manager?: boolean } }>(
          accessToken, devToken, topId,
          `SELECT customer.id, customer.manager FROM customer WHERE customer.id = ${topId}`,
        );
        const isManager = custRows[0]?.customer?.manager === true;
        if (isManager) {
          const children = await gaqlSearch<{ customerClient: { id: string; manager?: boolean; status?: string } }>(
            accessToken, devToken, topId,
            `SELECT customer_client.id, customer_client.manager, customer_client.status, customer_client.level
             FROM customer_client WHERE customer_client.level <= 2`,
            topId,
          );
          leaves = children
            .filter((c) =>
              c.customerClient?.manager !== true &&
              c.customerClient?.status !== "CANCELED" &&
              c.customerClient?.id && String(c.customerClient.id) !== topId,
            )
            .map((c) => ({ id: String(c.customerClient.id), login: topId }));
        } else {
          leaves = [{ id: topId, login: topId }];
        }
      } catch (e) {
        console.warn(`Discover ${topId} failed:`, e instanceof Error ? e.message : e);
      }
      return leaves;
    }));
    const allLeaves = discoverAll.flat();

    // Bounded concurrency for leaf syncs.
    const CONCURRENCY = 6;
    const runLeaf = async (leaf: { id: string; login: string }) => {
      try {
        const query = `
          SELECT
            customer.id, customer.descriptive_name, customer.currency_code,
            campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
            campaign_budget.amount_micros,
            metrics.impressions, metrics.clicks, metrics.cost_micros,
            metrics.conversions, metrics.conversions_value, metrics.ctr
          FROM campaign
          WHERE segments.date BETWEEN '${start}' AND '${end}'
            AND campaign.status != 'REMOVED'
        `;
        const rows = await gaqlSearch<CampaignRow>(
          accessToken, devToken, leaf.id, query, leaf.login,
        );
        if (rows.length === 0) return;

        syncedAccountIds.add(leaf.id);
        const acctName = rows[0]?.customer?.descriptiveName ?? `Account ${leaf.id}`;
        const currency = rows[0]?.customer?.currencyCode ?? null;

        const agg = new Map<string, {
          campaign_id: string; campaign_name: string; status: string | null;
          channel: string | null; budget_micros: number;
          impressions: number; clicks: number; costMicros: number;
          conversions: number; conversionValue: number;
        }>();
        for (const r of rows) {
          const cid = String(r.campaign.id);
          const cur = agg.get(cid) ?? {
            campaign_id: cid,
            campaign_name: r.campaign.name,
            status: r.campaign.status ?? null,
            channel: r.campaign.advertisingChannelType ?? null,
            budget_micros: Number(r.campaignBudget?.amountMicros ?? 0),
            impressions: 0, clicks: 0, costMicros: 0,
            conversions: 0, conversionValue: 0,
          };
          cur.impressions += Number(r.metrics?.impressions ?? 0);
          cur.clicks += Number(r.metrics?.clicks ?? 0);
          cur.costMicros += Number(r.metrics?.costMicros ?? 0);
          cur.conversions += Number(r.metrics?.conversions ?? 0);
          cur.conversionValue += Number(r.metrics?.conversionsValue ?? 0);
          agg.set(cid, cur);
        }

        const upserts = Array.from(agg.values()).map((c) => ({
          user_id: userId,
          login_customer_id: leaf.login,
          google_customer_id: leaf.id,
          account_name: acctName,
          campaign_id: c.campaign_id,
          campaign_name: c.campaign_name,
          status: c.status,
          advertising_channel_type: c.channel,
          currency_code: currency,
          budget_amount: c.budget_micros / 1_000_000,
          impressions: c.impressions,
          clicks: c.clicks,
          cost: c.costMicros / 1_000_000,
          conversions: c.conversions,
          conversion_value: c.conversionValue,
          ctr: c.impressions > 0 ? c.clicks / c.impressions : 0,
          date_range_start: start,
          date_range_end: end,
          last_synced_at: new Date().toISOString(),
        }));

        const { error: upErr } = await admin.from("google_ads_campaigns").upsert(upserts, {
          onConflict: "user_id,google_customer_id,campaign_id,date_range_start,date_range_end",
        });
        if (upErr) throw new Error(`Upsert failed: ${upErr.message}`);
        totalSynced += upserts.length;

        // Mirror to org-wide clients + campaigns (bulk).
        if (orgId) {
          try {
            let clientId: string | null = null;
            const { data: match } = await admin.from("clients").select("id")
              .eq("organization_id", orgId).ilike("name", acctName).maybeSingle();
            if (match?.id) clientId = match.id as string;
            if (!clientId) {
              const { data: created } = await admin.from("clients").insert({
                organization_id: orgId,
                name: acctName,
                industry: "Google Ads",
                color: "#4285F4",
                status: "active",
              }).select("id").single();
              clientId = created?.id ?? null;
            }

            const names = upserts.map((c) => c.campaign_name);
            const { data: existingRows } = await admin.from("campaigns")
              .select("id,name")
              .eq("organization_id", orgId).eq("platform", "Google")
              .in("name", names);
            const existingByName = new Map<string, string>();
            for (const r of existingRows ?? []) existingByName.set(r.name as string, r.id as string);

            const toInsert: any[] = [];
            const updates: Promise<any>[] = [];
            for (const c of upserts) {
              const payload = {
                organization_id: orgId,
                client_id: clientId,
                name: c.campaign_name,
                platform: "Google",
                status: c.status === "ENABLED" ? "Live"
                  : c.status === "PAUSED" ? "Paused" : "Planned",
                budget: Number(c.budget_amount ?? 0),
                spend: Number(c.cost ?? 0),
                impressions: Number(c.impressions ?? 0),
                clicks: Number(c.clicks ?? 0),
                conversions: Math.round(Number(c.conversions ?? 0)),
                leads: Math.round(Number(c.conversions ?? 0)),
                start_date: c.date_range_start,
                end_date: c.date_range_end,
              };
              const existingId = existingByName.get(c.campaign_name);
              if (existingId) {
                updates.push(admin.from("campaigns").update(payload).eq("id", existingId));
              } else {
                toInsert.push(payload);
              }
            }
            if (toInsert.length) await admin.from("campaigns").insert(toInsert);
            if (updates.length) await Promise.all(updates);
          } catch (mirrorErr) {
            console.warn("Mirror failed:", mirrorErr instanceof Error ? mirrorErr.message : mirrorErr);
          }
        }
      } catch (e) {
        console.warn(`Sync leaf ${leaf.id} failed:`, e instanceof Error ? e.message : e);
      }
    };

    // Simple concurrency pool over allLeaves.
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, allLeaves.length) }, async () => {
      while (cursor < allLeaves.length) {
        const idx = cursor++;
        await runLeaf(allLeaves[idx]);
      }
    }));

    await admin.from("google_ads_sync_log").insert({
      user_id: userId,
      google_customer_id: Array.from(syncedAccountIds).join(","),
      status: "success",
      campaigns_synced: totalSynced,
      accounts_synced: syncedAccountIds.size,
      date_range_start: start,
      date_range_end: end,
      triggered_by: triggeredBy,
    });

    return new Response(JSON.stringify({
      success: true,
      campaigns_synced: totalSynced,
      accounts_synced: syncedAccountIds.size,
      date_range: { start, end },
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("sync-google-ads error:", message);
    if (userId) {
      try {
        const admin = createClient(supabaseUrl, serviceKey);
        await admin.from("google_ads_sync_log").insert({
          user_id: userId, status: "error", error_message: message, triggered_by: triggeredBy,
        });
      } catch { /* ignore */ }
    }
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});