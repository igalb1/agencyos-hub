import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// One-shot helper: writes the current SUPABASE_SERVICE_ROLE_KEY into the
// Supabase Vault under the name `cron_service_role_key` so that the
// pg_cron triggers can authenticate against the sync edge functions.
//
// Caller must be the project's super_admin (verified via JWT + user_roles).
// Delete this function after running it once.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Missing Authorization");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user?.id) throw new Error("Unauthorized");

    const admin = createClient(supabaseUrl, serviceKey);

    // Verify caller is super_admin
    const { data: roleRow, error: roleErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "super_admin")
      .maybeSingle();
    if (roleErr) throw new Error(`Role check failed: ${roleErr.message}`);
    if (!roleRow) throw new Error("Forbidden: super_admin only");

    // Update or create the vault secret via SQL.
    // vault.update_secret requires the secret id, so we upsert by name.
    const { error: rpcErr } = await admin.rpc("seed_cron_service_role_key", {
      _key: serviceKey,
    });
    if (rpcErr) throw new Error(`Vault write failed: ${rpcErr.message}`);

    return new Response(
      JSON.stringify({ success: true, message: "cron_service_role_key seeded" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("seed-cron-key error:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});