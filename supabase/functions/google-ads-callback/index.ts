import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      return new Response(`<html><body><script>window.opener?.postMessage({type:'google-ads-error',error:'${error}'},'*');window.close();</script><p>Authorization failed. You can close this window.</p></body></html>`, {
        headers: { "Content-Type": "text/html" },
      });
    }

    if (!code || !stateParam) {
      return new Response("Missing code or state", { status: 400 });
    }

    const state = JSON.parse(atob(stateParam));
    const { user_id, redirect_url } = state;

    if (!user_id) {
      return new Response("Invalid state", { status: 400 });
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
      return new Response(`<html><body><script>window.opener?.postMessage({type:'google-ads-error',error:'token_exchange_failed'},'*');window.close();</script><p>Failed to connect. You can close this window.</p></body></html>`, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Get account info using the access token
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
      return new Response(`<html><body><script>window.opener?.postMessage({type:'google-ads-error',error:'save_failed'},'*');window.close();</script><p>Failed to save. You can close this window.</p></body></html>`, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Success - redirect back or close popup
    const successHtml = `<html><body><script>
      window.opener?.postMessage({type:'google-ads-success',accountName:'${accountName.replace(/'/g, "\\'")}'},'*');
      window.close();
    </script><p>Connected successfully! You can close this window.</p></body></html>`;

    return new Response(successHtml, {
      headers: { "Content-Type": "text/html" },
    });
  } catch (error: unknown) {
    console.error("Callback error:", error);
    return new Response(`<html><body><script>window.opener?.postMessage({type:'google-ads-error',error:'unknown'},'*');window.close();</script><p>An error occurred. You can close this window.</p></body></html>`, {
      headers: { "Content-Type": "text/html" },
    });
  }
});
