import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { verifyState, validateRedirectUrl, getAllowedRedirectOrigins } from "../_shared/oauth-state.ts";

const SAFE_FALLBACK = "https://agencyos-hub.lovable.app/integrations";

function htmlClose(messageHe: string, messageEn: string, success: boolean) {
  const color = success ? "#00D4FF" : "#ef4444";
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>Google</title>
<style>body{font-family:system-ui;background:#070C14;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}div{padding:24px;border-radius:12px;background:rgba(255,255,255,0.04);max-width:420px}h1{font-size:18px;margin:0 0 8px;color:${color}}p{opacity:.8;font-size:14px;margin:0}</style>
</head><body><div><h1>${messageHe}</h1><p>${messageEn}</p>
<script>try{window.opener&&window.opener.postMessage({type:"google_user_oauth",success:${success}},"*");}catch(e){}setTimeout(()=>window.close(),1500);</script>
</div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const oauthErr = url.searchParams.get("error");

    if (!stateParam) return new Response("Missing state", { status: 400 });
    const state = await verifyState<{ user_id: string; redirect_url: string }>(stateParam);
    if (!state?.user_id) return new Response("Invalid state", { status: 400 });

    const baseRedirect =
      validateRedirectUrl(state.redirect_url, getAllowedRedirectOrigins()) ?? SAFE_FALLBACK;

    if (oauthErr) {
      return Response.redirect(`${baseRedirect}?google_user_error=${encodeURIComponent(oauthErr)}`, 302);
    }
    if (!code) {
      return Response.redirect(`${baseRedirect}?google_user_error=missing_code`, 302);
    }

    const clientId = Deno.env.get("GOOGLE_USER_OAUTH_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_USER_OAUTH_CLIENT_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    if (!clientId || !clientSecret) {
      return htmlClose("Google OAuth לא הוגדר", "Google OAuth not configured", false);
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: clientId, client_secret: clientSecret,
        redirect_uri: `${supabaseUrl}/functions/v1/google-user-oauth-callback`,
        grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("Token exchange failed:", tokens);
      return htmlClose("ההתחברות נכשלה", "Token exchange failed", false);
    }

    // Fetch user info to know which account connected
    let email = "";
    let sub = "";
    try {
      const ui = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (ui.ok) {
        const j = await ui.json();
        email = j.email ?? "";
        sub = j.sub ?? "";
      }
    } catch (e) { console.error("userinfo failed", e); }

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error: rpcErr } = await supabase.rpc("set_google_user_tokens", {
      _user_id: state.user_id,
      _google_email: email || "google-account",
      _google_sub: sub || null,
      _access_token: tokens.access_token,
      _refresh_token: tokens.refresh_token ?? null,
      _expires_at: expiresAt,
      _scope: tokens.scope ?? null,
    });
    if (rpcErr) {
      console.error("set_google_user_tokens failed:", rpcErr);
      return htmlClose("שמירה נכשלה", "Failed to save connection", false);
    }

    return htmlClose(`מחובר ל-${email || "Google"}`, "Connected. You can close this window.", true);
  } catch (e) {
    console.error("callback error:", e);
    return htmlClose("שגיאה לא צפויה", "Unexpected error", false);
  }
});