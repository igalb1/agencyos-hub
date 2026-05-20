import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  if (!res.ok) throw new Error(`Token refresh failed [${res.status}]: ${await res.text()}`);
  return await res.json() as { access_token: string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const clientId = Deno.env.get("GOOGLE_ADS_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_ADS_CLIENT_SECRET")!;
  const developerToken = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN")!;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) throw new Error("Unauthorized");
    const userId = claims.claims.sub as string;

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: tokensRows, error: tokenErr } = await admin.rpc("get_integration_tokens", {
      _user_id: userId,
      _provider: "google_ads",
    });
    if (tokenErr) throw new Error(tokenErr.message);
    const tokens = (tokensRows as any[])?.[0];
    if (!tokens?.refresh_token) throw new Error("Not connected");

    const refreshed = await refreshAccessToken(tokens.refresh_token, clientId, clientSecret);
    const accessToken = refreshed.access_token;

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    // SET account
    if (body.account_id) {
      const accountId = String(body.account_id).replace(/[^0-9]/g, "");
      // fetch name
      let accountName = `Google Ads (${accountId})`;
      try {
        const r = await fetch(
          `https://googleads.googleapis.com/v21/customers/${accountId}/googleAds:search`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "developer-token": developerToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ query: "SELECT customer.descriptive_name FROM customer LIMIT 1" }),
          }
        );
        const t = await r.text();
        if (r.ok) {
          const j = JSON.parse(t);
          const name = j.results?.[0]?.customer?.descriptiveName;
          if (name) accountName = `${name} (${accountId})`;
        }
      } catch (_) { /* ignore name lookup */ }

      const { error: upErr } = await admin.rpc("set_integration_tokens", {
        _user_id: userId,
        _provider: "google_ads",
        _access_token: tokens.access_token,
        _refresh_token: tokens.refresh_token,
        _account_id: accountId,
        _account_name: accountName,
        _token_expires_at: tokens.token_expires_at ?? null,
      });
      if (upErr) throw new Error(upErr.message);

      return new Response(JSON.stringify({ success: true, account_id: accountId, account_name: accountName }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // LIST accounts
    const listRes = await fetch(
      "https://googleads.googleapis.com/v21/customers:listAccessibleCustomers",
      { headers: { Authorization: `Bearer ${accessToken}`, "developer-token": developerToken } }
    );
    const listText = await listRes.text();
    if (!listRes.ok) throw new Error(`List failed [${listRes.status}]: ${listText.slice(0, 400)}`);
    const listData = JSON.parse(listText);
    const ids: string[] = (listData.resourceNames ?? []).map((r: string) => r.replace("customers/", ""));

    // Fetch descriptive name for each (best-effort, parallel)
    const accounts = await Promise.all(ids.map(async (id) => {
      try {
        const r = await fetch(
          `https://googleads.googleapis.com/v21/customers/${id}/googleAds:search`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "developer-token": developerToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ query: "SELECT customer.descriptive_name, customer.manager FROM customer LIMIT 1" }),
          }
        );
        const t = await r.text();
        if (!r.ok) return { id, name: id, manager: false };
        const j = JSON.parse(t);
        const c = j.results?.[0]?.customer ?? {};
        return { id, name: c.descriptiveName ?? id, manager: !!c.manager };
      } catch {
        return { id, name: id, manager: false };
      }
    }));

    return new Response(JSON.stringify({ accounts, current: tokens.account_id || null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
