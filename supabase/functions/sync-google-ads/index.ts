import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncRequest {
  date_range_start?: string;
  date_range_end?: string;
  triggered_by?: "manual" | "cron";
  user_id?: string;
}

const GADS_VERSION = "v18";

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

async function parseJsonSafe(res: Response, label: string): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} returned non-JSON [${res.status}]: ${text.slice(0, 300)}`);
  }
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
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
    throw new Error(`Token refresh failed: ${JSON.stringify(json)}`);
  }
  return json;
}

interface GadsCustomer { id: string; descriptiveName?: string; currencyCode?: string; manager?: boolean; }

async function listAccessibleCustomers(accessToken: string, devToken: string): Promise<string[]> {
  const res = await fetch(`https://googleads.googleapis.com/${GADS_VERSION}/customers:listAccessibleCustomers`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": devToken,
    },
  });
  const data = await parseJsonSafe(res, "listAccessibleCustomers");
  if (!res.ok) throw new Error(`listAccessibleCustomers failed [${res.status}]: ${JSON.stringify(data)}`);
  const names: string[] = data.resourceNames ?? [];
  return names.map((n) => n.replace("customers/", ""));
}

async function searchStream<T = Record<string, unknown>>(
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
  if (!res.ok) throw new Error(`searchStream failed [${res.status}]: ${JSON.stringify(data)}`);
  const out: T[] = [];
  const chunks = Array.isArray(data) ? data : [data];
  for (const c of chunks) for (const r of (c.results ?? [])) out.push(r as T);
  return out;
}

interface CustomerRow { customer: { id: string; descriptiveName?: string; currencyCode?: string; manager?: boolean }; }
interface CampaignRow {
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

    const { data: tokensRows, error: tokenErr } = await admin.rpc("get_integration_tokens", {
      _user_id: userId, _provider: "google_ads",
    });
    if (tokenErr) throw new Error(`Token fetch failed: ${tokenErr.message}`);
    const tokens = (tokensRows as Array<{ access_token: string; refresh_token: string | null; token_expires_at: string | null; account_name: string | null }>)?.[0];
    if (!tokens?.access_token) throw new Error("Google Ads not connected");

    let accessToken = tokens.access_token;
    const expired = tokens.token_expires_at && new Date(tokens.token_expires_at).getTime() < Date.now() + 60_000;
    if (expired) {
      if (!tokens.refresh_token) throw new Error("Access token expired and no refresh token available; please reconnect");
      const refreshed = await refreshAccessToken(tokens.refresh_token);
      accessToken = refreshed.access_token;
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await admin.rpc("set_integration_tokens", {
        _user_id: userId, _provider: "google_ads",
        _access_token: accessToken, _refresh_token: tokens.refresh_token,
        _account_id: "", _account_name: tokens.account_name ?? "Google Ads",
        _token_expires_at: newExpiry,
      });
    }

    const accessible = await listAccessibleCustomers(accessToken, devToken);
    if (accessible.length === 0) throw new Error("No accessible Google Ads accounts");

    let totalSynced = 0;
    const accountIdsForLog: string[] = [];

    // For each accessible customer, fetch its child accounts (if manager) and campaigns.
    for (const topId of accessible) {
      let leafIds: { id: string; loginId: string }[] = [];
      try {
        const custQuery = `
          SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.manager
          FROM customer WHERE customer.id = ${topId}
        `;
        const rows = await searchStream<CustomerRow>(accessToken, devToken, topId, custQuery);
        const isManager = rows[0]?.customer?.manager === true;
        if (isManager) {
          const childQuery = `
            SELECT customer_client.id, customer_client.descriptive_name,
                   customer_client.currency_code, customer_client.manager, customer_client.level
            FROM customer_client WHERE customer_client.level <= 2
          `;
          const clients = await searchStream<{ customerClient: { id: string; manager?: boolean } }>(
            accessToken, devToken, topId, childQuery, topId,
          );
          leafIds = clients
            .filter((c) => c.customerClient?.manager !== true && c.customerClient?.id)
            .map((c) => ({ id: String(c.customerClient.id), loginId: topId }));
        } else {
          leafIds = [{ id: topId, loginId: topId }];
        }
      } catch (e) {
        console.warn(`Skipping customer ${topId}:`, e instanceof Error ? e.message : e);
        continue;
      }

      for (const leaf of leafIds) {
        try {
          const startCmp = start.replace(/-/g, "");
          const endCmp = end.replace(/-/g, "");
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
          // Note: BETWEEN literal dates accepted by GAQL
          const rowsList = await searchStream<CampaignRow & CustomerRow>(
            accessToken, devToken, leaf.id, query, leaf.loginId,
          );
          if (rowsList.length === 0) continue;

          accountIdsForLog.push(leaf.id);

          // Aggregate metrics per campaign across days (since query returns per-day rows when segments.date is selected; here we did not select it, so aggregation is already done)
          const acctName = rowsList[0]?.customer?.descriptiveName ?? `Account ${leaf.id}`;
          const currency = rowsList[0]?.customer?.currencyCode ?? null;

          const upsertRows = rowsList.map((r) => {
            const impressions = Number(r.metrics?.impressions ?? 0);
            const clicks = Number(r.metrics?.clicks ?? 0);
            const costMicros = Number(r.metrics?.costMicros ?? 0);
            const budgetMicros = Number(r.campaignBudget?.amountMicros ?? 0);
            return {
              user_id: userId,
              google_customer_id: String(leaf.id),
              account_name: acctName,
              campaign_id: String(r.campaign.id),
              campaign_name: r.campaign.name,
              status: r.campaign.status ?? null,
              advertising_channel_type: r.campaign.advertisingChannelType ?? null,
              currency_code: currency,
              budget_amount: budgetMicros / 1_000_000,
              impressions,
              clicks,
              cost: costMicros / 1_000_000,
              conversions: Number(r.metrics?.conversions ?? 0),
              conversion_value: Number(r.metrics?.conversionsValue ?? 0),
              ctr: Number(r.metrics?.ctr ?? (impressions > 0 ? clicks / impressions : 0)),
              date_range_start: start,
              date_range_end: end,
              last_synced_at: new Date().toISOString(),
            };
          });

          const { error: upErr } = await admin.from("google_ads_campaigns").upsert(upsertRows, {
            onConflict: "user_id,google_customer_id,campaign_id,date_range_start,date_range_end",
          });
          if (upErr) throw new Error(`Upsert failed: ${upErr.message}`);
          totalSynced += upsertRows.length;

          // Mirror into org-wide campaigns + clients
          try {
            const { data: memberRow } = await admin
              .from("organization_members").select("organization_id")
              .eq("user_id", userId).limit(1).maybeSingle();
            const orgId = memberRow?.organization_id as string | undefined;
            if (orgId) {
              const fallbackName = `Google Ads - ${acctName}`;
              let clientId: string | null = null;
              if (acctName) {
                const { data: match } = await admin.from("clients").select("id")
                  .eq("organization_id", orgId).ilike("name", acctName).maybeSingle();
                if (match?.id) clientId = match.id;
              }
              if (!clientId) {
                const { data: match2 } = await admin.from("clients").select("id")
                  .eq("organization_id", orgId).eq("name", fallbackName).maybeSingle();
                if (match2?.id) clientId = match2.id;
              }
              if (!clientId) {
                const { data: newClient } = await admin.from("clients").insert({
                  organization_id: orgId,
                  name: acctName || fallbackName,
                  industry: "Google Ads",
                  color: "#4285F4",
                  status: "active",
                }).select("id").single();
                clientId = newClient?.id ?? null;
              }
              for (const r of upsertRows) {
                const campaignPayload = {
                  organization_id: orgId,
                  client_id: clientId,
                  name: r.campaign_name,
                  platform: "Google",
                  status: r.status === "ENABLED" ? "Live" : r.status === "PAUSED" ? "Paused" : "Planned",
                  budget: Number(r.budget_amount ?? 0),
                  spend: Number(r.cost ?? 0),
                  impressions: Number(r.impressions ?? 0),
                  clicks: Number(r.clicks ?? 0),
                  conversions: Math.round(Number(r.conversions ?? 0)),
                  leads: Math.round(Number(r.conversions ?? 0)),
                  start_date: r.date_range_start,
                  end_date: r.date_range_end,
                };
                const { data: existing } = await admin.from("campaigns").select("id")
                  .eq("organization_id", orgId).eq("platform", "Google").eq("name", r.campaign_name).maybeSingle();
                if (existing?.id) {
                  await admin.from("campaigns").update(campaignPayload).eq("id", existing.id);
                } else {
                  await admin.from("campaigns").insert(campaignPayload);
                }
              }
            }
          } catch (mirrorErr) {
            console.warn("Mirror to org campaigns failed:", mirrorErr instanceof Error ? mirrorErr.message : mirrorErr);
          }
        } catch (e) {
          console.warn(`Sync failed for leaf ${leaf.id}:`, e instanceof Error ? e.message : e);
        }
      }
    }

    await admin.from("google_ads_sync_log").insert({
      user_id: userId,
      google_customer_id: accountIdsForLog.join(","),
      status: "success",
      campaigns_synced: totalSynced,
      date_range_start: start,
      date_range_end: end,
      triggered_by: triggeredBy,
    });

    return new Response(JSON.stringify({
      success: true,
      campaigns_synced: totalSynced,
      accounts_synced: accountIdsForLog.length,
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
      } catch (_) { /* ignore */ }
    }
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});