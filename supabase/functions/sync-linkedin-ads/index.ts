import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncRequest {
  date_range_start?: string; // YYYY-MM-DD
  date_range_end?: string;   // YYYY-MM-DD
  triggered_by?: "manual" | "cron";
  user_id?: string;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`LinkedIn token refresh failed [${res.status}]: ${txt}`);
  }
  return await res.json() as { access_token: string; expires_in: number };
}

const LI_VERSION = "202509"; // LinkedIn versioned API (YYYYMM, must be active)
const LI_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "LinkedIn-Version": LI_VERSION,
  "X-Restli-Protocol-Version": "2.0.0",
  "Content-Type": "application/json",
});

interface AdAccount { id: number; name: string; currency: string; }

async function listAdAccounts(token: string): Promise<AdAccount[]> {
  // Get all ad accounts the user has access to
  const url = "https://api.linkedin.com/rest/adAccounts?q=search&search=(status:(values:List(ACTIVE,DRAFT)))";
  const res = await fetch(url, { headers: LI_HEADERS(token) });
  const data = await res.json();
  if (!res.ok) throw new Error(`List ad accounts failed [${res.status}]: ${JSON.stringify(data)}`);
  return (data.elements ?? []).map((a: { id: number; name: string; currency: string }) => ({
    id: a.id, name: a.name, currency: a.currency,
  }));
}

interface LiCampaign {
  id: number;
  name: string;
  status: string;
  type: string;
  dailyBudget?: { amount: string; currencyCode: string };
  totalBudget?: { amount: string; currencyCode: string };
}

async function listCampaigns(token: string, accountId: number): Promise<LiCampaign[]> {
  const url = `https://api.linkedin.com/rest/adAccounts/${accountId}/adCampaigns?q=search`;
  const res = await fetch(url, { headers: LI_HEADERS(token) });
  const data = await res.json();
  if (!res.ok) throw new Error(`List campaigns failed [${res.status}]: ${JSON.stringify(data)}`);
  return data.elements ?? [];
}

interface LiAnalyticsRow {
  pivotValues?: string[];
  impressions?: number;
  clicks?: number;
  costInLocalCurrency?: string;
  externalWebsiteConversions?: number;
  conversionValueInLocalCurrency?: string;
}

async function fetchAnalytics(
  token: string,
  accountId: number,
  campaignIds: number[],
  start: string,
  end: string,
): Promise<Map<string, LiAnalyticsRow>> {
  const out = new Map<string, LiAnalyticsRow>();
  if (campaignIds.length === 0) return out;

  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);

  // LinkedIn requires URN-encoded campaign list; chunk to keep URL short
  const chunk = 20;
  for (let i = 0; i < campaignIds.length; i += chunk) {
    const ids = campaignIds.slice(i, i + chunk);
    const campaignsParam = `List(${ids.map(id => `urn%3Ali%3AsponsoredCampaign%3A${id}`).join(",")})`;
    const dateRange = `(start:(year:${sy},month:${sm},day:${sd}),end:(year:${ey},month:${em},day:${ed}))`;
    const fields = "pivotValues,impressions,clicks,costInLocalCurrency,externalWebsiteConversions,conversionValueInLocalCurrency";

    const url =
      `https://api.linkedin.com/rest/adAnalytics` +
      `?q=analytics&pivot=CAMPAIGN&timeGranularity=ALL` +
      `&dateRange=${dateRange}` +
      `&campaigns=${campaignsParam}` +
      `&fields=${fields}`;

    const res = await fetch(url, { headers: LI_HEADERS(token) });
    const data = await res.json();
    if (!res.ok) throw new Error(`Analytics failed [${res.status}]: ${JSON.stringify(data)}`);

    for (const row of (data.elements ?? []) as LiAnalyticsRow[]) {
      const urn = row.pivotValues?.[0]; // e.g. "urn:li:sponsoredCampaign:12345"
      const cid = urn?.split(":").pop();
      if (cid) out.set(cid, row);
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const clientId = Deno.env.get("LINKEDIN_CLIENT_ID")!;
  const clientSecret = Deno.env.get("LINKEDIN_CLIENT_SECRET")!;

  let userId: string | null = null;
  let triggeredBy: "manual" | "cron" = "manual";

  try {
    const body = (await req.json().catch(() => ({}))) as SyncRequest;
    triggeredBy = body.triggered_by ?? "manual";

    const authHeader = req.headers.get("Authorization");
    if (triggeredBy === "cron" && body.user_id) {
      userId = body.user_id;
    } else {
      if (!authHeader?.startsWith("Bearer ")) throw new Error("Missing Authorization");
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData?.user?.id) throw new Error("Unauthorized");
      userId = userData.user.id;
    }

    const today = new Date();
    const start = body.date_range_start ?? isoDate(new Date(today.getTime() - 30 * 86400000));
    const end = body.date_range_end ?? isoDate(today);

    const admin = createClient(supabaseUrl, serviceKey);

    // Fetch tokens (uses Vault key automatically)
    const { data: tokensRows, error: tokenErr } = await admin.rpc("get_integration_tokens", {
      _user_id: userId,
      _provider: "linkedin_ads",
    });
    if (tokenErr) throw new Error(`Token fetch failed: ${tokenErr.message}`);
    const tokens = (tokensRows as Array<{ access_token: string; refresh_token: string | null; account_id: string | null; account_name: string | null }>)?.[0];
    if (!tokens) throw new Error("LinkedIn Ads not connected");

    // Refresh access token if we have a refresh token; otherwise use stored access token
    let accessToken = tokens.access_token;
    if (tokens.refresh_token) {
      try {
        const refreshed = await refreshAccessToken(tokens.refresh_token, clientId, clientSecret);
        accessToken = refreshed.access_token;
      } catch (e) {
        console.warn("Refresh failed, using stored access token:", e instanceof Error ? e.message : e);
      }
    }

    // Discover accessible ad accounts
    const accounts = await listAdAccounts(accessToken);
    if (accounts.length === 0) throw new Error("No accessible LinkedIn Ad Accounts");

    let totalSynced = 0;
    const accountIdsForLog: string[] = [];

    for (const acc of accounts) {
      accountIdsForLog.push(String(acc.id));
      const campaigns = await listCampaigns(accessToken, acc.id);
      if (campaigns.length === 0) continue;

      const analytics = await fetchAnalytics(
        accessToken,
        acc.id,
        campaigns.map(c => c.id),
        start,
        end,
      );

      const rows = campaigns.map(c => {
        const a = analytics.get(String(c.id));
        const impressions = Number(a?.impressions ?? 0);
        const clicks = Number(a?.clicks ?? 0);
        return {
          user_id: userId,
          linkedin_account_id: String(acc.id),
          campaign_id: String(c.id),
          campaign_name: c.name,
          status: c.status ?? null,
          campaign_type: c.type ?? null,
          currency_code: acc.currency ?? c.dailyBudget?.currencyCode ?? null,
          daily_budget_amount: c.dailyBudget?.amount ? Number(c.dailyBudget.amount) : 0,
          total_budget_amount: c.totalBudget?.amount ? Number(c.totalBudget.amount) : 0,
          impressions,
          clicks,
          cost_in_local_currency: a?.costInLocalCurrency ? Number(a.costInLocalCurrency) : 0,
          conversions: Number(a?.externalWebsiteConversions ?? 0),
          conversion_value_in_local_currency: a?.conversionValueInLocalCurrency ? Number(a.conversionValueInLocalCurrency) : 0,
          ctr: impressions > 0 ? clicks / impressions : 0,
          date_range_start: start,
          date_range_end: end,
          last_synced_at: new Date().toISOString(),
        };
      });

      if (rows.length > 0) {
        const { error: upErr } = await admin
          .from("linkedin_ads_campaigns")
          .upsert(rows, {
            onConflict: "user_id,linkedin_account_id,campaign_id,date_range_start,date_range_end",
          });
        if (upErr) throw new Error(`Upsert failed: ${upErr.message}`);
        totalSynced += rows.length;

        // ===== Mirror into org-wide campaigns + clients tables =====
        try {
          // Find the user's organization (first membership)
          const { data: memberRow } = await admin
            .from("organization_members")
            .select("organization_id")
            .eq("user_id", userId)
            .limit(1)
            .maybeSingle();
          const orgId = memberRow?.organization_id as string | undefined;

          if (orgId) {
            // Try to match an existing client by the LinkedIn account name (case-insensitive).
            // Fall back to the previous "LinkedIn Ads - X" naming, otherwise create a new client.
            const accountName = (acc.name ?? "").trim();
            const fallbackName = `LinkedIn Ads - ${accountName}`;
            let clientId: string | null = null;

            if (accountName.length > 0) {
              const { data: matchByAccount } = await admin
                .from("clients")
                .select("id")
                .eq("organization_id", orgId)
                .ilike("name", accountName)
                .maybeSingle();
              if (matchByAccount?.id) clientId = matchByAccount.id;
            }

            if (!clientId) {
              const { data: matchByFallback } = await admin
                .from("clients")
                .select("id")
                .eq("organization_id", orgId)
                .eq("name", fallbackName)
                .maybeSingle();
              if (matchByFallback?.id) clientId = matchByFallback.id;
            }

            if (!clientId) {
              const { data: newClient } = await admin
                .from("clients")
                .insert({
                  organization_id: orgId,
                  name: accountName || fallbackName,
                  industry: "LinkedIn Ads",
                  color: "#0A66C2",
                  status: "active",
                })
                .select("id")
                .single();
              clientId = newClient?.id ?? null;
            }

            // Upsert each campaign by (org, name, platform=LinkedIn)
            for (const r of rows) {
              const campaignPayload = {
                organization_id: orgId,
                client_id: clientId,
                name: r.campaign_name,
                platform: "LinkedIn",
                status: r.status === "ACTIVE" ? "Live" : r.status === "PAUSED" ? "Paused" : "Planned",
                budget: Number(r.daily_budget_amount ?? r.total_budget_amount ?? 0),
                spend: Number(r.cost_in_local_currency ?? 0),
                impressions: Number(r.impressions ?? 0),
                clicks: Number(r.clicks ?? 0),
                conversions: Math.round(Number(r.conversions ?? 0)),
                leads: Math.round(Number(r.conversions ?? 0)),
                start_date: r.date_range_start,
                end_date: r.date_range_end,
              };
              const { data: existingCamp } = await admin
                .from("campaigns")
                .select("id")
                .eq("organization_id", orgId)
                .eq("platform", "LinkedIn")
                .eq("name", r.campaign_name)
                .maybeSingle();
              if (existingCamp?.id) {
                await admin.from("campaigns").update(campaignPayload).eq("id", existingCamp.id);
              } else {
                await admin.from("campaigns").insert(campaignPayload);
              }
            }
          }
        } catch (mirrorErr) {
          console.warn("Mirror to org campaigns failed:", mirrorErr instanceof Error ? mirrorErr.message : mirrorErr);
        }
      }
    }

    await admin.from("linkedin_ads_sync_log").insert({
      user_id: userId,
      linkedin_account_id: accountIdsForLog.join(","),
      status: "success",
      campaigns_synced: totalSynced,
      date_range_start: start,
      date_range_end: end,
      triggered_by: triggeredBy,
    });

    return new Response(
      JSON.stringify({
        success: true,
        campaigns_synced: totalSynced,
        accounts_synced: accounts.length,
        date_range: { start, end },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("sync-linkedin-ads error:", message);

    if (userId) {
      try {
        const admin = createClient(supabaseUrl, serviceKey);
        await admin.from("linkedin_ads_sync_log").insert({
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
