import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { verifyState } from "../_shared/oauth-state.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StatePayload {
  user_id: string;
  redirect_url: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const errParam = url.searchParams.get("error");
  const errDesc = url.searchParams.get("error_description");

  const state = stateRaw ? await verifyState<StatePayload>(stateRaw) : null;
  const fallbackRedirect = "https://agencyos-hub.lovable.app/integrations";
  const redirectBase = state?.redirect_url ?? fallbackRedirect;

  const redirectWith = (params: Record<string, string>) => {
    const u = new URL(redirectBase);
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    return Response.redirect(u.toString(), 302);
  };

  if (errParam) {
    return redirectWith({ linkedin_error: errDesc || errParam });
  }
  if (!code || !state) {
    return redirectWith({ linkedin_error: "Invalid OAuth callback" });
  }

  try {
    const clientId = Deno.env.get("LINKEDIN_CLIENT_ID")!;
    const clientSecret = Deno.env.get("LINKEDIN_CLIENT_SECRET")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Exchange code for token
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${supabaseUrl}/functions/v1/linkedin-ads-callback`,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) {
      return redirectWith({
        linkedin_error: `Token exchange failed: ${JSON.stringify(tokenJson)}`,
      });
    }

    const accessToken: string = tokenJson.access_token;
    const refreshToken: string | undefined = tokenJson.refresh_token;
    const expiresIn: number = tokenJson.expires_in ?? 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Fetch profile (OIDC userinfo) for account_name
    let accountName = "LinkedIn Account";
    let accountId = "";
    try {
      const userRes = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (userRes.ok) {
        const u = await userRes.json();
        accountName = u.name || u.email || accountName;
        accountId = u.sub || "";
      }
    } catch (_) {
      // non-fatal
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { error: setErr } = await supabase.rpc("set_integration_tokens", {
      _user_id: state.user_id,
      _provider: "linkedin_ads",
      _access_token: accessToken,
      _refresh_token: refreshToken ?? null,
      _account_id: accountId,
      _account_name: accountName,
      _token_expires_at: expiresAt,
    });

    if (setErr) {
      return redirectWith({ linkedin_error: setErr.message });
    }

    return redirectWith({ linkedin_connected: "1" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return redirectWith({ linkedin_error: message });
  }
});
