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

const FB_VERSION = "v21.0";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

interface FbAdAccount {
  id: string;          // act_<id>
  account_id: string;  // numeric
  name: string;
  currency: string;
}

async function listAdAccounts(token: string): Promise<FbAdAccount[]> {
  const url = `https://graph.facebook.com/${FB_VERSION}/me/adaccounts?fields=id,account_id,name,currency&limit=200&access_token=${token}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(`List ad accounts failed [${res.status}]: ${JSON.stringify(data)}`);
  return (data.data ?? []) as FbAdAccount[];
}

interface FbCampaign {
  id: string;
  name: string;
  status: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
}

async function listCampaigns(token: string, actId: string): Promise<FbCampaign[]> {
  const fields = "id,name,status,objective,daily_budget,lifetime_budget";
  const url = `https://graph.facebook.com/${FB_VERSION}/${actId}/campaigns?fields=${fields}&limit=500&access_token=${token}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(`List campaigns failed [${res.status}]: ${JSON.stringify(data)}`);
  return (data.data ?? []) as FbCampaign[];
}

interface FbInsightRow {
  campaign_id: string;
  impressions?: string;
  clicks?: string;
  spend?: string;
  ctr?: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
}

async function fetchInsights(
  token: string,
  actId: string,
  start: string,
  end: string,
): Promise<Map<string, FbInsightRow>> {
  const out = new Map<string, FbInsightRow>();
  const timeRange = encodeURIComponent(JSON.stringify({ since: start, until: end }));
  const fields = "campaign_id,impressions,clicks,spend,ctr,actions,action_values";
  let url: string | null =
    `https://graph.facebook.com/${FB_VERSION}/${actId}/insights` +
    `?level=campaign&fields=${fields}&time_range=${timeRange}&limit=500&access_token=${token}`;

  while (url) {
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(`Insights failed [${res.status}]: ${JSON.stringify(data)}`);
    for (const row of (data.data ?? []) as FbInsightRow[]) {
      if (row.campaign_id) out.set(row.campaign_id, row);
    }
    url = data.paging?.next ?? null;
  }
  return out;
}

function sumConversions(row?: FbInsightRow): { count: number; value: number } {
  if (!row) return { count: 0, value: 0 };
  const convTypes = new Set([
    "offsite_conversion.fb_pixel_purchase",
    "purchase",
    "offsite_conversion.fb_pixel_lead",
    "lead",
    "onsite_conversion.lead_grouped",
    "complete_registration",
  ]);
  let count = 0;
  for (const a of row.actions ?? []) {
    if (convTypes.has(a.action_type)) count += Number(a.value) || 0;
  }
  let value = 0;
  for (const a of row.action_values ?? []) {
    if (convTypes.has(a.action_type)) value += Number(a.value) || 0;
  }
  return { count, value };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  let userId: string | null = null;
  let triggeredBy: "manual" | "cron" = "manual";

  try {
    const body = (await req.json().catch(() => ({}))) as SyncRequest;
    triggeredBy = body.triggered_by ?? "manual";

    const authHeader = req.headers.get("Authorization");
    if (triggeredBy === "cron" && body.user_id) {
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
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData?.user?.id) throw new Error("Unauthorized");
      userId = userData.user.id;
    }

    const today = new Date();
    const start = body.date_range_start ?? isoDate(new Date(today.getTime() - 30 * 86400000));
    const end = body.date_range_end ?? isoDate(today);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: tokensRows, error: tokenErr } = await admin.rpc("get_integration_tokens", {
      _user_id: userId,
      _provider: "facebook_ads",
    });
    if (tokenErr) throw new Error(`Token fetch failed: ${tokenErr.message}`);
    const tokens = (tokensRows as Array<{ access_token: string; account_name: string | null }>)?.[0];
    if (!tokens?.access_token) throw new Error("Facebook Ads not connected");

    const accessToken = tokens.access_token;

    const accounts = await listAdAccounts(accessToken);
    if (accounts.length === 0) throw new Error("No accessible Facebook Ad Accounts");

    let totalSynced = 0;
    const accountIdsForLog: string[] = [];

    for (const acc of accounts) {
      accountIdsForLog.push(acc.account_id);
      const campaigns = await listCampaigns(accessToken, acc.id);
      if (campaigns.length === 0) continue;

      const insights = await fetchInsights(accessToken, acc.id, start, end);

      const rows = campaigns.map((c) => {
        const ins = insights.get(c.id);
        const impressions = Number(ins?.impressions ?? 0);
        const clicks = Number(ins?.clicks ?? 0);
        const spend = Number(ins?.spend ?? 0);
        const { count: convCount, value: convValue } = sumConversions(ins);
        return {
          user_id: userId,
          facebook_account_id: acc.account_id,
          account_name: acc.name,
          campaign_id: c.id,
          campaign_name: c.name,
          status: c.status ?? null,
          objective: c.objective ?? null,
          currency_code: acc.currency ?? null,
          daily_budget: c.daily_budget ? Number(c.daily_budget) / 100 : 0,
          lifetime_budget: c.lifetime_budget ? Number(c.lifetime_budget) / 100 : 0,
          impressions,
          clicks,
          spend,
          conversions: convCount,
          conversion_value: convValue,
          ctr: ins?.ctr ? Number(ins.ctr) / 100 : (impressions > 0 ? clicks / impressions : 0),
          date_range_start: start,
          date_range_end: end,
          last_synced_at: new Date().toISOString(),
        };
      });

      if (rows.length > 0) {
        const { error: upErr } = await admin
          .from("facebook_ads_campaigns")
          .upsert(rows, {
            onConflict: "user_id,facebook_account_id,campaign_id,date_range_start,date_range_end",
          });
        if (upErr) throw new Error(`Upsert failed: ${upErr.message}`);
        totalSynced += rows.length;

        // Mirror into org-wide campaigns + clients
        try {
          const { data: memberRow } = await admin
            .from("organization_members")
            .select("organization_id")
            .eq("user_id", userId)
            .limit(1)
            .maybeSingle();
          const orgId = memberRow?.organization_id as string | undefined;

          if (orgId) {
            const accountName = (acc.name ?? "").trim();
            const fallbackName = `Facebook Ads - ${accountName}`;
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
                  industry: "Facebook Ads",
                  color: "#1877F2",
                  status: "active",
                })
                .select("id")
                .single();
              clientId = newClient?.id ?? null;
            }

            for (const r of rows) {
              const campaignPayload = {
                organization_id: orgId,
                client_id: clientId,
                name: r.campaign_name,
                platform: "Facebook",
                status: r.status === "ACTIVE" ? "Live" : r.status === "PAUSED" ? "Paused" : "Planned",
                budget: Number(r.daily_budget ?? r.lifetime_budget ?? 0),
                spend: Number(r.spend ?? 0),
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
                .eq("platform", "Facebook")
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

    await admin.from("facebook_ads_sync_log").insert({
      user_id: userId,
      facebook_account_id: accountIdsForLog.join(","),
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
    console.error("sync-facebook-ads error:", message);

    if (userId) {
      try {
        const admin = createClient(supabaseUrl, serviceKey);
        await admin.from("facebook_ads_sync_log").insert({
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