import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

interface SyncRequest {
  config_id: string;
  triggered_by?: "manual" | "cron";
}

function nextRunFor(frequency: string): string | null {
  const now = Date.now();
  switch (frequency) {
    case "hourly": return new Date(now + 60 * 60 * 1000).toISOString();
    case "every_6_hours": return new Date(now + 6 * 60 * 60 * 1000).toISOString();
    case "daily": return new Date(now + 24 * 60 * 60 * 1000).toISOString();
    case "weekly": return new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
    default: return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const sheetsKey = Deno.env.get("GOOGLE_SHEETS_API_KEY");

  let configId: string | null = null;
  let orgId: string | null = null;
  let triggeredBy: "manual" | "cron" = "manual";
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
    if (!sheetsKey) throw new Error("GOOGLE_SHEETS_API_KEY is not configured (Google Sheets connector not linked)");

    const body = (await req.json().catch(() => ({}))) as SyncRequest;
    if (!body.config_id) throw new Error("Missing config_id");
    configId = body.config_id;
    triggeredBy = body.triggered_by ?? "manual";

    const authHeader = req.headers.get("Authorization");
    if (triggeredBy === "manual") {
      if (!authHeader?.startsWith("Bearer ")) throw new Error("Missing Authorization");
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims, error: claimsErr } = await userClient.auth.getClaims();
      if (claimsErr || !claims?.claims?.sub) throw new Error("Unauthorized");
    } else {
      if (!authHeader || authHeader !== `Bearer ${serviceKey}`) {
        throw new Error("Unauthorized cron call");
      }
    }

    // Load config
    const { data: config, error: cfgErr } = await admin
      .from("client_sheet_sync_configs")
      .select("*")
      .eq("id", configId)
      .maybeSingle();
    if (cfgErr || !config) throw new Error("Sync config not found");
    orgId = config.organization_id;

    const range = `${config.sheet_name}!${config.range_a1}`;
    const sheetsRes = await fetch(
      `${GATEWAY_URL}/spreadsheets/${config.spreadsheet_id}/values/${range}`,
      {
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": sheetsKey,
        },
      },
    );
    const sheetsData = await sheetsRes.json();
    if (!sheetsRes.ok) {
      throw new Error(`Sheets API error [${sheetsRes.status}]: ${JSON.stringify(sheetsData)}`);
    }

    const rows: string[][] = sheetsData.values ?? [];
    if (rows.length === 0) {
      await admin.from("client_sheet_sync_logs").insert({
        config_id: configId, organization_id: orgId, triggered_by: triggeredBy,
        status: "success", rows_read: 0, clients_created: 0, clients_updated: 0,
      });
      await admin.from("client_sheet_sync_configs").update({
        last_synced_at: new Date().toISOString(),
        next_run_at: nextRunFor(config.frequency),
      }).eq("id", configId);
      return new Response(JSON.stringify({ success: true, rows_read: 0, created: 0, updated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headerIdx = Math.max(0, (config.header_row ?? 1) - 1);
    const headers = (rows[headerIdx] ?? []).map((h) => String(h ?? "").trim());
    const dataRows = rows.slice(headerIdx + 1);

    const mapping = (config.column_mapping ?? {}) as Record<string, string>;
    // mapping = { sheetColumnName: clientField }
    const matchField: string = config.match_field || "name";

    // Pre-load existing clients for matching
    const { data: existingClients } = await admin
      .from("clients").select("id,name,industry,status,color")
      .eq("organization_id", orgId);
    const matchMap = new Map<string, any>();
    (existingClients ?? []).forEach((c: any) => {
      const key = String(c[matchField] ?? "").trim().toLowerCase();
      if (key) matchMap.set(key, c);
    });

    let created = 0;
    let updated = 0;
    const allowedFields = new Set(["name", "industry", "status", "color", "budget"]);

    for (const row of dataRows) {
      const record: Record<string, any> = {};
      headers.forEach((h, i) => {
        const target = mapping[h];
        if (!target || !allowedFields.has(target)) return;
        const value = row[i];
        if (value === undefined || value === null || value === "") return;
        if (target === "budget") {
          const num = Number(String(value).replace(/[^0-9.\-]/g, ""));
          if (!Number.isNaN(num)) record.budget = num;
        } else if (target === "status") {
          const v = String(value).trim().toLowerCase();
          record.status = v === "paused" || v === "מושהה" ? "paused" : "active";
        } else {
          record[target] = String(value).trim();
        }
      });

      if (!record.name) continue;

      const matchKey = String(record[matchField] ?? "").trim().toLowerCase();
      const existing = matchKey ? matchMap.get(matchKey) : undefined;

      if (existing) {
        const { error } = await admin
          .from("clients")
          .update(record)
          .eq("id", existing.id)
          .eq("organization_id", orgId);
        if (!error) updated++;
      } else {
        const { error } = await admin
          .from("clients")
          .insert({ ...record, organization_id: orgId });
        if (!error) created++;
      }
    }

    await admin.from("client_sheet_sync_logs").insert({
      config_id: configId, organization_id: orgId, triggered_by: triggeredBy,
      status: "success", rows_read: dataRows.length,
      clients_created: created, clients_updated: updated,
    });
    await admin.from("client_sheet_sync_configs").update({
      last_synced_at: new Date().toISOString(),
      next_run_at: nextRunFor(config.frequency),
    }).eq("id", configId);

    return new Response(
      JSON.stringify({ success: true, rows_read: dataRows.length, created, updated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("sync-clients-from-sheet error:", message);
    if (configId && orgId) {
      try {
        await admin.from("client_sheet_sync_logs").insert({
          config_id: configId, organization_id: orgId, triggered_by: triggeredBy,
          status: "error", error_message: message,
        });
      } catch (_) { /* ignore */ }
    }
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});