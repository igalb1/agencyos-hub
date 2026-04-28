import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

function extractSpreadsheetId(input: string): string {
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : input.trim();
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
    const spreadsheetId = extractSpreadsheetId(rawId);
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

    // Read just the header row from the chosen sheet
    const targetSheet = sheetName || sheets[0]?.title;
    let headers: string[] = [];
    let sample: string[][] = [];
    let effectiveHeaderRow = headerRow;
    if (targetSheet) {
      // Quote sheet name if needed, then URL-encode just that segment so spaces/specials
      // survive the gateway without being double-decoded. Keep the `!A1:ZZ26` part raw
      // because the colon must stay a literal colon for the Sheets API.
      // Per gateway docs: do NOT URL-encode the range. Pass sheet name raw,
      // quoting it only when it contains spaces/specials.
      const needsQuotes = /[^A-Za-z0-9_]/.test(targetSheet);
      const quoted = needsQuotes ? `'${targetSheet.replace(/'/g, "''")}'` : targetSheet;
      const range = `${quoted}!A${headerRow}:ZZ${headerRow + 25}`;
      const valsRes = await fetch(
        `${GATEWAY_URL}/spreadsheets/${spreadsheetId}/values/${range}`,
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
      const rows: string[][] = valsData.values ?? [];
      // Find first non-empty row to use as headers (skip leading blank rows).
      let headerIdx = 0;
      while (
        headerIdx < rows.length &&
        (rows[headerIdx] ?? []).every((c) => String(c ?? "").trim() === "")
      ) {
        headerIdx++;
      }
      headers = (rows[headerIdx] ?? []).map((h) => String(h ?? "").trim());
      // Trim trailing empty header cells
      while (headers.length > 0 && headers[headers.length - 1] === "") headers.pop();
      sample = rows.slice(headerIdx + 1, headerIdx + 6);
      effectiveHeaderRow = headerRow + headerIdx;
      if (headers.length === 0) {
        console.log("google-sheet-metadata: no headers found", {
          spreadsheetId, sheet: targetSheet, headerRow, rowCount: rows.length,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        spreadsheet_id: spreadsheetId,
        title: meta.properties?.title,
        sheets,
        headers,
        sample,
        effective_header_row: effectiveHeaderRow,
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