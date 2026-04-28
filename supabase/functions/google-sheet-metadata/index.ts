import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

function parseSpreadsheetInput(input: string): { spreadsheetId: string; gid?: string } {
  const trimmed = input.trim();
  const id = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] ?? trimmed;
  const gid = trimmed.match(/[?#&]gid=(\d+)/)?.[1];
  return { spreadsheetId: id, gid };
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

function quoteSheetName(name: string): string {
  return /[^A-Za-z0-9_]/.test(name) ? `'${name.replace(/'/g, "''")}'` : name;
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

function scoreHeaderRow(row: unknown[]): number {
  const cells = row.map((c) => String(c ?? "").trim()).filter(Boolean);
  if (cells.length === 0) return -100;
  const joined = cells.join(" ").toLowerCase();
  const knownHeaderHits = cells.filter((cell) => (
    /name|client|customer|campaign|platform|objective|budget|spend|cost|impression|click|lead|conversion|status|date|industry|שם|לקוח|לקוחות|קמפיין|פלטפורמה|תקציב|הוצאה|עלות|חשיפ|קליק|ליד|המר|סטטוס|תאריך|תחום/i
      .test(cell)
  )).length;
  const dataLikePenalty = cells.filter((cell) => /^\d+[\d,.:/ -]*$/.test(cell)).length;
  const titlePenalty = cells.length <= 2 && /client|clients|customers|לקוחות|לקוח/i.test(joined) ? 12 : 0;
  return cells.length * 3 + knownHeaderHits * 8 - dataLikePenalty * 3 - titlePenalty;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const sheetsKey = Deno.env.get("GOOGLE_SHEETS_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
    if (!sheetsKey) throw new Error("Google Sheets connector not linked");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Missing Authorization");
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) throw new Error("Unauthorized");

    const body = await req.json().catch(() => ({}));
    const rawId = String(body?.spreadsheet_id ?? "").trim();
    if (!rawId) throw new Error("Missing spreadsheet_id");
    const { spreadsheetId, gid } = parseSpreadsheetInput(rawId);
    const sheetName: string | undefined = body?.sheet_name;
    const headerRow: number = Number(body?.header_row ?? 1);

    // Get spreadsheet metadata (sheet names + title)
    const metaRes = await fetch(
      `${GATEWAY_URL}/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties(title,sheetId,gridProperties)`,
      {
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": sheetsKey,
        },
      },
    );
    const meta = await metaRes.json();
    if (!metaRes.ok) {
      throw new Error(`Sheets API error [${metaRes.status}]: ${JSON.stringify(meta)}`);
    }

    const sheets = (meta.sheets ?? []).map((s: any) => ({
      title: s.properties?.title,
      sheetId: s.properties?.sheetId,
      rowCount: s.properties?.gridProperties?.rowCount,
      columnCount: s.properties?.gridProperties?.columnCount,
    }));

    // Pick a worksheet from the explicit name, URL gid, or first tab.
    const targetSheet = sheetName || sheets.find((s: any) => String(s.sheetId) === gid)?.title || sheets[0]?.title;
    let headers: string[] = [];
    let sample: string[][] = [];
    let effectiveHeaderRow = headerRow;
    let effectiveRangeA1 = "A1:ZZ1000";
    if (targetSheet) {
      const quoted = quoteSheetName(targetSheet);
      const range = `${quoted}!A${headerRow}:ZZ${headerRow + 80}`;
      const valsRes = await fetch(
        `${GATEWAY_URL}/spreadsheets/${spreadsheetId}/values:batchGet?ranges=${encodeURIComponent(range)}`,
        {
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": sheetsKey,
          },
        },
      );
      const valsData = await valsRes.json();
      if (!valsRes.ok) {
        throw new Error(`Sheets API error [${valsRes.status}]: ${JSON.stringify(valsData)}`);
      }
      const rawRows: string[][] = valsData.valueRanges?.[0]?.values ?? [];
      let headerIdx = 0;
      let bestScore = -Infinity;
      rawRows.forEach((row, idx) => {
        const score = scoreHeaderRow(row ?? []);
        if (score > bestScore) {
          bestScore = score;
          headerIdx = idx;
        }
      });
      const bodyRows = rawRows.slice(headerIdx + 1);
      const headerWidth = (rawRows[headerIdx] ?? []).length;
      const dataWidth = Math.max(0, ...bodyRows.slice(0, 25).map((row) => row.length));
      const width = Math.max(headerWidth, dataWidth);
      headers = normalizeHeaders(normalizeRows([rawRows[headerIdx] ?? []], width)[0] ?? [], width);
      sample = normalizeRows(bodyRows, width).filter((row) => row.some(Boolean)).slice(0, 10);
      effectiveHeaderRow = headerRow + headerIdx;
      effectiveRangeA1 = `A${effectiveHeaderRow}:${columnName(Math.max(width, 1))}1000`;
      if (headers.length === 0) {
        console.log("google-sheet-metadata: no headers found", {
          spreadsheetId, sheet: targetSheet, headerRow, rowCount: rawRows.length,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        spreadsheet_id: spreadsheetId,
        title: meta.properties?.title,
        sheets,
        sheet_name: targetSheet,
        headers,
        sample,
        effective_header_row: effectiveHeaderRow,
        effective_range_a1: effectiveRangeA1,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("google-sheet-metadata error:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});