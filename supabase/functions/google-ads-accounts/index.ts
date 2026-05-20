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

    // For each directly-accessible customer, query customer_client to expand MCC children.
    // This returns BOTH the account itself and any sub-accounts under it (for MCCs).
    const accountMap = new Map<string, { id: string; name: string; manager: boolean; parent?: string }>();

    await Promise.all(ids.map(async (loginCid) => {
      // First, get this account's own name/manager status as a fallback
      try {
        const selfRes = await fetch(
          `https://googleads.googleapis.com/v21/customers/${loginCid}/googleAds:search`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "developer-token": developerToken,
              "login-customer-id": loginCid,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ query: "SELECT customer.descriptive_name, customer.manager FROM customer LIMIT 1" }),
          }
        );
        const t = await selfRes.text();
        if (selfRes.ok) {
          const j = JSON.parse(t);
          const c = j.results?.[0]?.customer ?? {};
          if (!accountMap.has(loginCid)) {
            accountMap.set(loginCid, { id: loginCid, name: c.descriptiveName ?? loginCid, manager: !!c.manager });
          }
        } else if (!accountMap.has(loginCid)) {
          accountMap.set(loginCid, { id: loginCid, name: loginCid, manager: false });
        }
      } catch {
        if (!accountMap.has(loginCid)) accountMap.set(loginCid, { id: loginCid, name: loginCid, manager: false });
      }

      // Expand children via customer_client (works for both MCC and regular accounts;
      // for regular accounts it just returns the single self row).
      try {
        const childRes = await fetch(
          `https://googleads.googleapis.com/v21/customers/${loginCid}/googleAds:searchStream`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "developer-token": developerToken,
              "login-customer-id": loginCid,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query: `
                SELECT
                  customer_client.client_customer,
                  customer_client.id,
                  customer_client.descriptive_name,
                  customer_client.manager,
                  customer_client.hidden,
                  customer_client.status
                FROM customer_client
                WHERE customer_client.status = 'ENABLED'
              `,
            }),
          }
        );
        const t = await childRes.text();
        if (!childRes.ok) return;
        const chunks = JSON.parse(t);
        const arr = Array.isArray(chunks) ? chunks : [chunks];
        for (const ch of arr) {
          for (const row of (ch.results ?? [])) {
            const cc = row.customerClient ?? {};
            if (cc.hidden) continue;
            const cid = String(cc.id ?? "");
            if (!cid) continue;
            // Only overwrite if we don't already have a better entry
            const existing = accountMap.get(cid);
            const entry = {
              id: cid,
              name: cc.descriptiveName || existing?.name || cid,
              manager: !!cc.manager,
              parent: cid !== loginCid ? loginCid : undefined,
            };
            accountMap.set(cid, entry);
          }
        }
      } catch { /* ignore */ }
    }));

    // Sort: client accounts first, then managers, alphabetical
    const accounts = Array.from(accountMap.values()).sort((a, b) => {
      if (a.manager !== b.manager) return a.manager ? 1 : -1;
      return a.name.localeCompare(b.name);
    });

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
