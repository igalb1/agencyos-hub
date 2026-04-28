import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

interface SyncRequest {
  config_id: string;
  triggered_by?: "manual" | "cron";
  stream?: boolean;
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

function quoteSheetName(name: string): string {
  return /[^A-Za-z0-9_]/.test(name) ? `'${name.replace(/'/g, "''")}'` : name;
}

function columnName(index: number): string {
  let n = Math.max(1, index);
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function startRowFromRange(rangeA1: string): number {
  const firstPart = rangeA1.split(":")[0]?.trim() ?? "A1";
  const match = firstPart.match(/\d+/);
  return match ? Math.max(1, Number(match[0])) : 1;
}

function normalizeRows(rows: unknown[][], width: number): string[][] {
  return rows.map((row) => Array.from({ length: width }, (_, i) => String(row?.[i] ?? "").trim()));
}

function normalizeHeaders(row: string[], width: number): string[] {
  const seen = new Map<string, number>();
  return Array.from({ length: width }, (_, i) => {
    const base = String(row[i] ?? "").trim() || `Column ${columnName(i + 1)}`;
    const key = base.toLowerCase();
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    return count === 0 ? base : `${base} ${count + 1}`;
  });
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
  let wantsStream = false;
  const admin = createClient(supabaseUrl, serviceKey);

  // Stream plumbing — only used when wantsStream === true.
  const encoder = new TextEncoder();
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  const emit = (event: Record<string, unknown>) => {
    if (!wantsStream || !controllerRef) return;
    try {
      controllerRef.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
    } catch (_) { /* stream closed */ }
  };

  const runSync = async (): Promise<{ rows_read: number; created: number; updated: number }> => {
  try {
    if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
    if (!sheetsKey) throw new Error("GOOGLE_SHEETS_API_KEY is not configured (Google Sheets connector not linked)");

    // Load config
    emit({ type: "stage", stage: "loading_config" });
    const { data: config, error: cfgErr } = await admin
      .from("client_sheet_sync_configs")
      .select("*")
      .eq("id", configId)
      .maybeSingle();
    if (cfgErr || !config) throw new Error("Sync config not found");
    orgId = config.organization_id;
    emit({ type: "stage", stage: "fetching_sheet", sheet: `${config.sheet_name}!${config.range_a1}` });

    const range = `${quoteSheetName(config.sheet_name)}!${config.range_a1}`;
    const sheetsRes = await fetch(
      `${GATEWAY_URL}/spreadsheets/${config.spreadsheet_id}/values:batchGet?ranges=${encodeURIComponent(range)}`,
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

    const rawRows: string[][] = sheetsData.valueRanges?.[0]?.values ?? sheetsData.values ?? [];
    const width = Math.max(0, ...rawRows.map((row) => row.length));
    const rows = normalizeRows(rawRows, width);
    if (rows.length === 0) {
      emit({ type: "stage", stage: "empty" });
      await admin.from("client_sheet_sync_logs").insert({
        config_id: configId, organization_id: orgId, triggered_by: triggeredBy,
        status: "success", rows_read: 0, clients_created: 0, clients_updated: 0,
      });
      await admin.from("client_sheet_sync_configs").update({
        last_synced_at: new Date().toISOString(),
        next_run_at: nextRunFor(config.frequency),
      }).eq("id", configId);
      emit({ type: "done", success: true, rows_read: 0, created: 0, updated: 0 });
      return { rows_read: 0, created: 0, updated: 0 };
    }

    const rangeStartRow = startRowFromRange(config.range_a1 ?? "A1:Z1000");
    const headerIdx = Math.max(0, Number(config.header_row ?? rangeStartRow) - rangeStartRow);
    const headers = normalizeHeaders(rows[headerIdx] ?? [], width);
    const dataRows = rows.slice(headerIdx + 1).filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""));
    emit({ type: "rows_read", total: dataRows.length, headers });

    const mapping = (config.column_mapping ?? {}) as Record<string, string>;
    // mapping = { sheetColumnName: clientField }
    const matchField: string = config.match_field || "name";
    const syncMode: "flat" | "hierarchical" = (config.sync_mode === "hierarchical") ? "hierarchical" : "flat";

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
    let skipped = 0;
    let failed = 0;
    let campaignsCreated = 0;
    let campaignsUpdated = 0;
    const allowedClientFields = new Set(["name", "industry", "status", "color", "budget", "spend", "leads"]);
    const allowedCampaignFields = new Set([
      "campaign_name", "platform", "objective", "status",
      "budget", "spend", "impressions", "clicks", "leads", "conversions",
      "start_date", "end_date",
    ]);

    // Helpers
    const cleanNumber = (v: unknown): number | null => {
      if (v === undefined || v === null || v === "") return null;
      const num = Number(String(v).replace(/[^0-9.\-]/g, ""));
      return Number.isNaN(num) ? null : num;
    };
    const cleanDate = (v: unknown): string | null => {
      if (v === undefined || v === null || v === "") return null;
      const s = String(v).trim();
      // dd/mm/yyyy or dd-mm-yyyy
      const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
      if (m) {
        const [_, d, mo, y] = m;
        const yy = y.length === 2 ? `20${y}` : y;
        return `${yy}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
      }
      const dt = new Date(s);
      if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
      return null;
    };
    const normalizeStatus = (v: unknown): string | null => {
      if (v === undefined || v === null || v === "") return null;
      const s = String(v).trim().toLowerCase();
      if (s === "paused" || s === "מושהה" || s === "מושהית") return "paused";
      if (s === "planned" || s === "מתוכנן" || s === "מתוכננת" || s === "draft") return "Planned";
      if (s === "active" || s === "פעיל" || s === "פעילה" || s === "running" || s === "live") return "Live";
      if (s === "completed" || s === "הסתיים" || s === "הסתיימה") return "Completed";
      return s;
    };
    const normalizeObjective = (v: unknown): string | null => {
      if (v === undefined || v === null || v === "") return null;
      const s = String(v).trim().toLowerCase();
      if (/lead|ליד/.test(s)) return "leads";
      if (/sale|purchase|רכיש|מכיר/.test(s)) return "sales";
      if (/video|וידאו/.test(s)) return "video";
      if (/aware|reach|חשיפ|מודעות/.test(s)) return "awareness";
      if (/traffic|תנועה/.test(s)) return "traffic";
      if (/engagement|מעורבות/.test(s)) return "engagement";
      if (/app|אפליק/.test(s)) return "app";
      return "other";
    };

    // Build a per-row record from headers + row using the mapping, restricted to allowed targets.
    const buildRecord = (row: string[], allowed: Set<string>): Record<string, any> => {
      const rec: Record<string, any> = {};
      headers.forEach((h, i) => {
        const target = mapping[h];
        if (!target || !allowed.has(target)) return;
        const value = row[i];
        if (value === undefined || value === null || value === "") return;
        if (
          target === "budget" || target === "spend" ||
          target === "impressions" || target === "clicks" ||
          target === "leads" || target === "conversions"
        ) {
          const n = cleanNumber(value);
          if (n !== null) rec[target] = n;
        } else if (target === "start_date" || target === "end_date") {
          const d = cleanDate(value);
          if (d) rec[target] = d;
        } else if (target === "status") {
          const s = normalizeStatus(value);
          if (s) rec.status = s;
        } else {
          rec[target] = String(value).trim();
        }
      });
      return rec;
    };

    // Identify which mapped target a column points to (for hierarchical detection)
    const targetsByIndex = headers.map((h) => mapping[h] ?? null);
    const clientNameColIdx = targetsByIndex.findIndex((t) => t === "name");
    const campaignNameColIdx = targetsByIndex.findIndex((t) => t === "campaign_name");
    const sharedNameColIdx = targetsByIndex.findIndex((t) => t === "client_or_campaign_name");

    // ----- Custom-column auto-creation for unmapped headers (hierarchical campaigns only) -----
    // A header is "unmapped" if it has no mapping at all OR its mapping target is not a
    // recognized client/campaign field. Such columns become campaign custom columns.
    const recognizedTargets = new Set<string>([
      ...allowedClientFields,
      ...allowedCampaignFields,
    ]);
    const unmappedHeaderIdx: number[] = [];
    headers.forEach((h, i) => {
      if (!h) return;
      const t = mapping[h];
      if (!t || !recognizedTargets.has(t)) unmappedHeaderIdx.push(i);
    });
    // colName -> custom column row { id, type }
    const customColByName = new Map<string, { id: string; type: string }>();
    if (syncMode === "hierarchical" && unmappedHeaderIdx.length > 0) {
      const { data: existingCols } = await admin
        .from("campaign_custom_columns")
        .select("id,name,type,display_order")
        .eq("organization_id", orgId);
      let nextOrder = 0;
      (existingCols ?? []).forEach((c: any) => {
        customColByName.set(String(c.name).trim().toLowerCase(), { id: c.id, type: c.type });
        if (typeof c.display_order === "number" && c.display_order >= nextOrder) {
          nextOrder = c.display_order + 1;
        }
      });
      // Heuristic: sample a value from data rows for type detection
      const sampleValueAt = (idx: number): string => {
        for (const r of dataRows) {
          const v = r[idx];
          if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
        }
        return "";
      };
      const isNumericLike = (s: string) =>
        s !== "" && !isNaN(Number(s.replace(/[,₪$%\s]/g, "")));

      const toCreate: Array<{ idx: number; name: string; type: string }> = [];
      for (const idx of unmappedHeaderIdx) {
        const name = headers[idx];
        const key = name.trim().toLowerCase();
        if (customColByName.has(key)) continue;
        toCreate.push({
          idx,
          name,
          type: isNumericLike(sampleValueAt(idx)) ? "number" : "text",
        });
      }
      if (toCreate.length > 0) {
        const { data: created, error: createErr } = await admin
          .from("campaign_custom_columns")
          .insert(
            toCreate.map((c, i) => ({
              organization_id: orgId,
              name: c.name,
              type: c.type,
              display_order: nextOrder + i,
            })),
          )
          .select("id,name,type");
        if (createErr) {
          console.error("custom column create failed:", createErr.message);
        } else {
          (created ?? []).forEach((c: any) =>
            customColByName.set(String(c.name).trim().toLowerCase(), { id: c.id, type: c.type }),
          );
        }
      }
    }

    // Helper: write custom values for a campaign row (hierarchical mode)
    const writeCustomValuesForCampaign = async (campaignId: string, row: string[]) => {
      if (unmappedHeaderIdx.length === 0 || customColByName.size === 0) return;
      const valueRows: Array<{
        organization_id: string;
        campaign_id: string;
        column_id: string;
        value: string;
      }> = [];
      for (const idx of unmappedHeaderIdx) {
        const name = headers[idx];
        const col = customColByName.get(name.trim().toLowerCase());
        if (!col) continue;
        const raw = row[idx];
        if (raw === undefined || raw === null || String(raw).trim() === "") continue;
        valueRows.push({
          organization_id: orgId!,
          campaign_id: campaignId,
          column_id: col.id,
          value: String(raw),
        });
      }
      if (valueRows.length > 0) {
        await admin
          .from("campaign_custom_values")
          .upsert(valueRows, { onConflict: "campaign_id,column_id" });
      }
    };

    // Cache campaigns per client to allow upsert by (client_id, campaign name)
    const campaignCache = new Map<string, Map<string, { id: string }>>();
    const loadCampaignsFor = async (clientId: string) => {
      if (campaignCache.has(clientId)) return campaignCache.get(clientId)!;
      const { data: camps } = await admin
        .from("campaigns").select("id,name")
        .eq("organization_id", orgId)
        .eq("client_id", clientId);
      const m = new Map<string, { id: string }>();
      (camps ?? []).forEach((c: any) => {
        const k = String(c.name ?? "").trim().toLowerCase();
        if (k) m.set(k, { id: c.id });
      });
      campaignCache.set(clientId, m);
      return m;
    };

    // Upsert a client and return its row (id + fields)
    const upsertClient = async (rec: Record<string, any>, rowIndex: number): Promise<{ id: string } | null> => {
      const matchKey = String(rec[matchField] ?? "").trim().toLowerCase();
      const existing = matchKey ? matchMap.get(matchKey) : undefined;
      if (existing) {
        const { error } = await admin.from("clients").update(rec)
          .eq("id", existing.id).eq("organization_id", orgId);
        if (error) {
          failed++;
          emit({ type: "row", row: rowIndex, action: "error", name: rec.name, error: error.message });
          return null;
        }
        updated++;
        emit({ type: "row", row: rowIndex, action: "updated", name: rec.name });
        return { id: existing.id };
      } else {
        const { data: ins, error } = await admin.from("clients")
          .insert({ ...rec, organization_id: orgId })
          .select("id,name,industry,status,color").single();
        if (error || !ins) {
          failed++;
          emit({ type: "row", row: rowIndex, action: "error", name: rec.name, error: error?.message ?? "insert failed" });
          return null;
        }
        created++;
        const k = String((ins as any)[matchField] ?? "").trim().toLowerCase();
        if (k) matchMap.set(k, ins);
        emit({ type: "row", row: rowIndex, action: "created", name: rec.name });
        return { id: (ins as any).id };
      }
    };

    // ---------------- Hierarchical mode ----------------
    if (syncMode === "hierarchical") {
      let currentClientId: string | null = null;
      let currentClientName: string | null = null;

      // Shared-column mode: one column holds both client and campaign names.
      // Heuristic: the FIRST non-empty value in that column starts a new client;
      // subsequent non-empty values are campaigns under that client; empty rows
      // are skipped; a row that has the shared name AND no other campaign-data
      // mapped fields filled is treated as a new client header (resets context).
      if (sharedNameColIdx >= 0 && clientNameColIdx < 0 && campaignNameColIdx < 0) {
        // Determine which column indexes contribute campaign-only signal
        const campaignSignalIdx = headers
          .map((h, i) => ({ h, i, t: mapping[h] }))
          .filter(({ t }) => t && allowedCampaignFields.has(t) && t !== "campaign_name")
          .map(({ i }) => i);

        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i];
          const rowIndex = i + 1;
          const sharedName = String(row[sharedNameColIdx] ?? "").trim();
          if (!sharedName) {
            // Empty name row: end current client group
            currentClientId = null;
            currentClientName = null;
            skipped++;
            emit({ type: "row", row: rowIndex, action: "skipped", reason: "empty name" });
            continue;
          }

          const hasCampaignData = campaignSignalIdx.some((idx) => {
            const v = row[idx];
            return v !== undefined && v !== null && String(v).trim() !== "";
          });

          // No active client yet → this row MUST be a client header
          if (!currentClientId) {
            const clientRec = buildRecord(row, allowedClientFields);
            clientRec.name = sharedName;
            const res = await upsertClient(clientRec, rowIndex);
            currentClientId = res?.id ?? null;
            currentClientName = sharedName;
            continue;
          }

          // Active client + this row has no campaign data → treat as a new client header
          if (!hasCampaignData) {
            const clientRec = buildRecord(row, allowedClientFields);
            clientRec.name = sharedName;
            const res = await upsertClient(clientRec, rowIndex);
            currentClientId = res?.id ?? null;
            currentClientName = sharedName;
            continue;
          }

          // Otherwise: campaign row under current client
          const campaignRec = buildRecord(row, allowedCampaignFields);
          delete campaignRec.campaign_name;
          const finalRec: Record<string, any> = {
            ...campaignRec,
            name: sharedName,
            client_id: currentClientId,
          };
          if (!finalRec.objective) finalRec.objective = "leads";
          if (!finalRec.status) finalRec.status = "Planned";

          const cache = await loadCampaignsFor(currentClientId);
          const key = sharedName.toLowerCase();
          const existingCamp = cache.get(key);
          if (existingCamp) {
            const { error } = await admin.from("campaigns")
              .update(finalRec).eq("id", existingCamp.id).eq("organization_id", orgId);
            if (error) {
              failed++;
              emit({ type: "row", row: rowIndex, action: "error", name: `${currentClientName} / ${sharedName}`, error: error.message });
            } else {
              campaignsUpdated++;
              await writeCustomValuesForCampaign(existingCamp.id, row);
              emit({ type: "row", row: rowIndex, action: "updated", name: `${currentClientName} / ${sharedName}` });
            }
          } else {
            const { data: ins, error } = await admin.from("campaigns")
              .insert({ ...finalRec, organization_id: orgId })
              .select("id").single();
            if (error || !ins) {
              failed++;
              emit({ type: "row", row: rowIndex, action: "error", name: `${currentClientName} / ${sharedName}`, error: error?.message ?? "insert failed" });
            } else {
              campaignsCreated++;
              cache.set(key, { id: (ins as any).id });
              await writeCustomValuesForCampaign((ins as any).id, row);
              emit({ type: "row", row: rowIndex, action: "created", name: `${currentClientName} / ${sharedName}` });
            }
          }
        }

        await admin.from("client_sheet_sync_logs").insert({
          config_id: configId, organization_id: orgId, triggered_by: triggeredBy,
          status: "success", rows_read: dataRows.length,
          clients_created: created, clients_updated: updated,
          campaigns_created: campaignsCreated, campaigns_updated: campaignsUpdated,
        });
        await admin.from("client_sheet_sync_configs").update({
          last_synced_at: new Date().toISOString(),
          next_run_at: nextRunFor(config.frequency),
        }).eq("id", configId);

        emit({
          type: "done", success: true,
          rows_read: dataRows.length, created, updated, skipped, failed,
          campaigns_created: campaignsCreated, campaigns_updated: campaignsUpdated,
        });
        return { rows_read: dataRows.length, created, updated };
      }

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const rowIndex = i + 1;
        const rawClientName = clientNameColIdx >= 0 ? String(row[clientNameColIdx] ?? "").trim() : "";
        const rawCampaignName = campaignNameColIdx >= 0 ? String(row[campaignNameColIdx] ?? "").trim() : "";

        // Treat as client header row when: client name is present AND no campaign name on that row.
        if (rawClientName && !rawCampaignName) {
          const clientRec = buildRecord(row, allowedClientFields);
          if (!clientRec.name) {
            skipped++;
            emit({ type: "row", row: rowIndex, action: "skipped", reason: "missing client name" });
            continue;
          }
          const res = await upsertClient(clientRec, rowIndex);
          currentClientId = res?.id ?? null;
          currentClientName = clientRec.name;
          continue;
        }

        // Otherwise: treat as a campaign row under the current client.
        if (!rawCampaignName) {
          skipped++;
          emit({ type: "row", row: rowIndex, action: "skipped", reason: "no campaign name" });
          continue;
        }
        if (!currentClientId) {
          // No active client context — skip campaign row to avoid orphan.
          skipped++;
          emit({ type: "row", row: rowIndex, action: "skipped", reason: "no client context for campaign" });
          continue;
        }
        const campaignRec = buildRecord(row, allowedCampaignFields);
        // Map campaign_name -> name
        const campaignName = String(campaignRec.campaign_name ?? rawCampaignName).trim();
        delete campaignRec.campaign_name;
        const finalRec: Record<string, any> = {
          ...campaignRec,
          name: campaignName,
          client_id: currentClientId,
        };
        // Ensure objective defaults to leads if not provided (table requires not-null)
        if (!finalRec.objective) finalRec.objective = "leads";
        if (!finalRec.status) finalRec.status = "Planned";

        const cache = await loadCampaignsFor(currentClientId);
        const key = campaignName.toLowerCase();
        const existingCamp = cache.get(key);
        if (existingCamp) {
          const { error } = await admin.from("campaigns")
            .update(finalRec).eq("id", existingCamp.id).eq("organization_id", orgId);
          if (error) {
            failed++;
            emit({ type: "row", row: rowIndex, action: "error", name: `${currentClientName} / ${campaignName}`, error: error.message });
          } else {
            campaignsUpdated++;
            await writeCustomValuesForCampaign(existingCamp.id, row);
            emit({ type: "row", row: rowIndex, action: "updated", name: `${currentClientName} / ${campaignName}` });
          }
        } else {
          const { data: ins, error } = await admin.from("campaigns")
            .insert({ ...finalRec, organization_id: orgId })
            .select("id").single();
          if (error || !ins) {
            failed++;
            emit({ type: "row", row: rowIndex, action: "error", name: `${currentClientName} / ${campaignName}`, error: error?.message ?? "insert failed" });
          } else {
            campaignsCreated++;
            cache.set(key, { id: (ins as any).id });
            await writeCustomValuesForCampaign((ins as any).id, row);
            emit({ type: "row", row: rowIndex, action: "created", name: `${currentClientName} / ${campaignName}` });
          }
        }
      }

      await admin.from("client_sheet_sync_logs").insert({
        config_id: configId, organization_id: orgId, triggered_by: triggeredBy,
        status: "success", rows_read: dataRows.length,
        clients_created: created, clients_updated: updated,
        campaigns_created: campaignsCreated, campaigns_updated: campaignsUpdated,
      });
      await admin.from("client_sheet_sync_configs").update({
        last_synced_at: new Date().toISOString(),
        next_run_at: nextRunFor(config.frequency),
      }).eq("id", configId);

      emit({
        type: "done", success: true,
        rows_read: dataRows.length, created, updated, skipped, failed,
        campaigns_created: campaignsCreated, campaigns_updated: campaignsUpdated,
      });
      return { rows_read: dataRows.length, created, updated };
    }

    // ---------------- Flat mode (legacy) ----------------
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const record = buildRecord(row, allowedClientFields);

      const rowIndex = i + 1;
      if (!record.name) {
        skipped++;
        emit({ type: "row", row: rowIndex, action: "skipped", reason: "missing name" });
        continue;
      }
      // For flat mode the status normalization should keep the existing 'active' default
      if (record.status && record.status !== "paused") {
        record.status = "active";
      }
      await upsertClient(record, rowIndex);
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

    emit({
      type: "done", success: true,
      rows_read: dataRows.length, created, updated, skipped, failed,
    });
    return { rows_read: dataRows.length, created, updated };
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
    emit({ type: "done", success: false, error: message });
    throw error;
  }
  };

  // -------- Request parsing & auth (shared by streaming and JSON paths) --------
  try {
    const body = (await req.json().catch(() => ({}))) as SyncRequest;
    if (!body.config_id) throw new Error("Missing config_id");
    configId = body.config_id;
    triggeredBy = body.triggered_by ?? "manual";
    wantsStream = body.stream === true;

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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (wantsStream) {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controllerRef = controller;
        runSync()
          .catch(() => { /* already emitted "done" with success:false */ })
          .finally(() => {
            try { controller.close(); } catch (_) { /* noop */ }
          });
      },
    });
    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  }

  // Non-streaming JSON path (cron, legacy callers)
  try {
    const result = await runSync();
    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});