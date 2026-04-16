import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (!stateParam) {
      return new Response("Missing state", { status: 400 });
    }

    const state = JSON.parse(atob(stateParam));
    const { user_id, redirect_url } = state;
    const baseRedirect = redirect_url || "https://localhost:3000/integrations";

    if (error) {
      return Response.redirect(`${baseRedirect}?google_ads_error=${error}`, 302);
    }

    if (!code || !user_id) {
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
      console.error("Token exchange failed:", tokens);
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

    const { error: upsertError } = await supabase
      .from("user_integrations")
      .upsert(
        {
          user_id,
          provider: "google_ads",
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt,
          account_id: accountId,
          account_name: accountName,
          is_connected: true,
        },
        { onConflict: "user_id,provider" }
      );

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return Response.redirect(`${baseRedirect}?google_ads_error=save_failed`, 302);
    }

    // Success - redirect back to app
    return Response.redirect(`${baseRedirect}?google_ads_success=true&account=${encodeURIComponent(accountName)}`, 302);
  } catch (error: unknown) {
    console.error("Callback error:", error);
    return Response.redirect(`https://localhost:3000/integrations?google_ads_error=unknown`, 302);
  }
});
