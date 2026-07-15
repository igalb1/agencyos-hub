// Exchange OAuth code for tokens, encrypt via set_integration_tokens, redirect back to app.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { verifyState, validateRedirectUrl, getAllowedRedirectOrigins } from "../_shared/oauth-state.ts";

const SAFE_FALLBACK = "https://agencyos-hub.lovable.app/integrations";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");

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

    if (oauthError) return redirectWith({ google_ads_error: oauthError });
    if (!code) return redirectWith({ google_ads_error: "missing_code" });

    const clientId = Deno.env.get("GOOGLE_ADS_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_ADS_CLIENT_SECRET")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const redirectUri = `${supabaseUrl}/functions/v1/google-ads-callback`;

    // Exchange code -> tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
      console.error("Google Ads token exchange failed:", tokenJson);
      return redirectWith({ google_ads_error: `token_exchange: ${tokenJson.error ?? "unknown"}` });
    }

    const accessToken: string = tokenJson.access_token;
    const refreshToken: string | null = tokenJson.refresh_token ?? null;
    const expiresAt = new Date(Date.now() + (tokenJson.expires_in ?? 3600) * 1000).toISOString();

    // Fetch user email for display
    let accountName = "Google Ads";
    try {
      const ui = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (ui.ok) {
        const j = await ui.json();
        accountName = j.email ?? j.name ?? accountName;
      }
    } catch { /* non-fatal */ }

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error: setErr } = await admin.rpc("set_integration_tokens", {
      _user_id: state.user_id,
      _provider: "google_ads",
      _access_token: accessToken,
      _refresh_token: refreshToken,
      _account_id: "",
      _account_name: accountName,
      _token_expires_at: expiresAt,
    });
    if (setErr) {
      console.error("set_integration_tokens failed:", setErr);
      return redirectWith({ google_ads_error: setErr.message });
    }

    return redirectWith({ google_ads_connected: "1" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("google-ads-callback error:", message);
    return Response.redirect(
      `${SAFE_FALLBACK}?google_ads_error=${encodeURIComponent(message)}`, 302,
    );
  }
});