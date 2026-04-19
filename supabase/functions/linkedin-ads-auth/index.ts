import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { signState, validateRedirectUrl, getAllowedRedirectOrigins } from "../_shared/oauth-state.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get("LINKEDIN_CLIENT_ID");
    if (!clientId) throw new Error("LINKEDIN_CLIENT_ID is not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { redirect_url } = await req.json();
    if (!redirect_url || typeof redirect_url !== "string") {
      return new Response(JSON.stringify({ error: "redirect_url is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeRedirect = validateRedirectUrl(redirect_url, getAllowedRedirectOrigins());
    if (!safeRedirect) {
      return new Response(JSON.stringify({ error: "Invalid redirect_url" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const state = await signState({
      user_id: claimsData.claims.sub,
      redirect_url: safeRedirect,
    });

    // Scopes:
    // - openid, profile, email: OIDC sign-in
    // - r_ads, r_ads_reporting: Advertising API (requires LinkedIn approval)
    const scope = "openid profile email r_ads r_ads_reporting";

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: `${Deno.env.get("SUPABASE_URL")}/functions/v1/linkedin-ads-callback`,
      state,
      scope,
    });

    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;

    return new Response(JSON.stringify({ url: authUrl }), {
      status: 200,
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
