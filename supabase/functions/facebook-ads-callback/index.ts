import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { verifyState, validateRedirectUrl, getAllowedRedirectOrigins } from "../_shared/oauth-state.ts";

const SAFE_FALLBACK = "https://agencyos-hub.lovable.app/integrations";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");
    const oauthErrorDesc = url.searchParams.get("error_description");

    if (!stateParam) return new Response("Missing state", { status: 400 });

    const state = await verifyState<{ user_id: string; redirect_url: string }>(stateParam);
    if (!state?.user_id) return new Response("Invalid state", { status: 400 });

    const baseRedirect =
      validateRedirectUrl(state.redirect_url, getAllowedRedirectOrigins()) ?? SAFE_FALLBACK;

    const redirectWith = (params: Record<string, string>) => {
      const u = new URL(baseRedirect);
      Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
      return Response.redirect(u.toString(), 302);
    };

    if (oauthError) {
      return redirectWith({ facebook_error: oauthErrorDesc || oauthError });
    }
    if (!code) {
      return redirectWith({ facebook_error: "missing_code" });
    }

    const clientId = Deno.env.get("FACEBOOK_APP_ID")!;
    const clientSecret = Deno.env.get("FACEBOOK_APP_SECRET")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const redirectUri = `${supabaseUrl}/functions/v1/facebook-ads-callback`;

    // Exchange code for short-lived token
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    });
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?${tokenParams.toString()}`,
    );
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
      console.error("FB token exchange failed:", tokenJson);
      return redirectWith({ facebook_error: `token_exchange_failed: ${JSON.stringify(tokenJson)}` });
    }

    let accessToken: string = tokenJson.access_token;
    let expiresIn: number = tokenJson.expires_in ?? 3600;

    // Exchange short-lived → long-lived (~60 days)
    try {
      const llParams = new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: clientId,
        client_secret: clientSecret,
        fb_exchange_token: accessToken,
      });
      const llRes = await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?${llParams.toString()}`,
      );
      const llJson = await llRes.json();
      if (llRes.ok && llJson.access_token) {
        accessToken = llJson.access_token;
        expiresIn = llJson.expires_in ?? expiresIn;
      }
    } catch (e) {
      console.warn("Long-lived token exchange failed:", e);
    }

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Fetch user info (name + id)
    let accountName = "Facebook Account";
    let accountId = "";
    try {
      const meRes = await fetch(
        `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${accessToken}`,
      );
      if (meRes.ok) {
        const me = await meRes.json();
        accountName = me.name || accountName;
        accountId = me.id || "";
      }
    } catch (_) { /* non-fatal */ }

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error: setErr } = await supabase.rpc("set_integration_tokens", {
      _user_id: state.user_id,
      _provider: "facebook_ads",
      _access_token: accessToken,
      _refresh_token: null,
      _account_id: accountId,
      _account_name: accountName,
      _token_expires_at: expiresAt,
    });

    if (setErr) {
      console.error("set_integration_tokens failed:", setErr);
      return redirectWith({ facebook_error: setErr.message });
    }

    return redirectWith({ facebook_connected: "1" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("facebook-ads-callback error:", message);
    return Response.redirect(`${SAFE_FALLBACK}?facebook_error=${encodeURIComponent(message)}`, 302);
  }
});