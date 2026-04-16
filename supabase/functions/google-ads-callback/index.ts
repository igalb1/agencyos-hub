import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { verifyState, validateRedirectUrl, getAllowedRedirectOrigins } from "../_shared/oauth-state.ts";

const SAFE_FALLBACK_REDIRECT = "https://agencyos-hub.lovable.app/integrations";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (!stateParam) {
      return new Response("Missing state", { status: 400 });
    }

    // Verify HMAC-signed state — rejects forged or tampered states
    const state = await verifyState<{ user_id: string; redirect_url: string }>(stateParam);
    if (!state || !state.user_id || !state.redirect_url) {
      return new Response("Invalid state", { status: 400 });
    }

    // Re-validate redirect against allowlist before using it
    const baseRedirect =
      validateRedirectUrl(state.redirect_url, getAllowedRedirectOrigins()) ?? SAFE_FALLBACK_REDIRECT;
    const { user_id } = state;

    if (error) {
      return Response.redirect(`${baseRedirect}?google_ads_error=${encodeURIComponent(error)}`, 302);
    }

    if (!code) {
      return Response.redirect(`${baseRedirect}?google_ads_error=missing_params`, 302);
    }

    const clientId = Deno.env.get("GOOGLE_ADS_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_ADS_CLIENT_SECRET")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${supabaseUrl}/functions/v1/google-ads-callback`,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Token exchange failed");
      return Response.redirect(`${baseRedirect}?google_ads_error=token_exchange_failed`, 302);
    }

    // Get account info
    const developerToken = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN")!;
    let accountName = "Google Ads Account";
    let accountId = "";

    try {
      const customerResponse = await fetch(
        "https://googleads.googleapis.com/v18/customers:listAccessibleCustomers",
        {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            "developer-token": developerToken,
          },
        }
      );
      const customerData = await customerResponse.json();
      if (customerData.resourceNames?.length > 0) {
        accountId = customerData.resourceNames[0].replace("customers/", "");
        accountName = `Google Ads (${accountId})`;
      }
    } catch (e) {
      console.error("Failed to fetch customer info:", e);
    }

    // Store tokens using service role
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    const encryptionKey = Deno.env.get("INTEGRATIONS_ENCRYPTION_KEY");
    if (!encryptionKey) {
      console.error("INTEGRATIONS_ENCRYPTION_KEY not configured");
      return Response.redirect(`${baseRedirect}?google_ads_error=encryption_key_missing`, 302);
    }

    const { error: upsertError } = await supabase.rpc("set_integration_tokens", {
      _user_id: user_id,
      _provider: "google_ads",
      _access_token: tokens.access_token,
      _refresh_token: tokens.refresh_token,
      _account_id: accountId,
      _account_name: accountName,
      _token_expires_at: expiresAt,
      _encryption_key: encryptionKey,
    });

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return Response.redirect(`${baseRedirect}?google_ads_error=save_failed`, 302);
    }

    // Success - redirect back to app
    return Response.redirect(`${baseRedirect}?google_ads_success=true&account=${encodeURIComponent(accountName)}`, 302);
  } catch (error: unknown) {
    console.error("Callback error:", error);
    return Response.redirect(`${SAFE_FALLBACK_REDIRECT}?google_ads_error=unknown`, 302);
  }
});
