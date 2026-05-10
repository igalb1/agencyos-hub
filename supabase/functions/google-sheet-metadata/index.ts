import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";
const GOOGLE_SHEETS_DIRECT = "https://sheets.googleapis.com/v4";

interface SheetsAuth {
  baseUrl: string;
  headers: Record<string, string>;
  source: "user" | "connector";
  email?: string;
}

async function getUserGoogleToken(
  supabaseUrl: string, serviceKey: string, userId: string,
): Promise<{ access_token: string; email: string } | null> {
  const admin = createClient(supabaseUrl, serviceKey);
  const { data, error } = await admin.rpc("get_google_user_tokens", { _user_id: userId });
  if (error || !data || data.length === 0) return null;
  const row = data[0] as {
    access_token: string; refresh_token: string | null;
    token_expires_at: string | null; google_email: string;
  };
  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
  // Refresh if expired or expiring within 60s
  if (Date.now() < expiresAt - 60_000) {
    return { access_token: row.access_token, email: row.google_email };
  }
  if (!row.refresh_token) return null;

  const clientId = Deno.env.get("GOOGLE_USER_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_USER_OAUTH_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      refresh_token: row.refresh_token, grant_type: "refresh_token",
    }),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) {
    console.error("Token refresh failed:", j);
    return null;
  }
  const newExpiresAt = j.expires_in
    ? new Date(Date.now() + j.expires_in * 1000).toISOString()
    : null;
  await admin.rpc("set_google_user_tokens", {
    _user_id: userId,
    _google_email: row.google_email,
    _google_sub: null,
    _access_token: j.access_token,
    _refresh_token: null, // keep existing
    _expires_at: newExpiresAt,
    _scope: j.scope ?? null,
  });
  return { access_token: j.access_token, email: row.google_email };
}

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

function formatExcelSerialIfApplicable(value: string): string {
  const s = value.trim();
  if (!/^\d{4,5}(\.\d+)?$/.test(s)) return value;
  const n = Number(s);
  if (n < 20000 || n > 80000) return value;
  const dt = new Date((n - 25569) * 86400 * 1000);
  if (Number.isNaN(dt.getTime())) return value;
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const yy = dt.getUTCFullYear();
  return `${dd}/${mm}/${yy}`;
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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Missing Authorization");
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) throw new Error("Unauthorized");
    const userId = claims.claims.sub;

    const body = await req.json().catch(() => ({}));
    const rawId = String(body?.spreadsheet_id ?? "").trim();
    if (!rawId) throw new Error("Missing spreadsheet_id");
    const { spreadsheetId, gid } = parseSpreadsheetInput(rawId);
    const sheetName: string | undefined = body?.sheet_name;
    const headerRow: number = Number(body?.header_row ?? 1);

    // Prefer the user's personal Google connection. Fall back to the workspace connector.
    const userTok = await getUserGoogleToken(supabaseUrl, serviceKey, userId);
    let auth: SheetsAuth;
    if (userTok) {
      auth = {
        baseUrl: GOOGLE_SHEETS_DIRECT,
        headers: { Authorization: `Bearer ${userTok.access_token}` },
        source: "user",
        email: userTok.email,
      };
    } else if (lovableKey && sheetsKey) {
      auth = {
        baseUrl: GATEWAY_URL,
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": sheetsKey,
        },
        source: "connector",
      };
    } else {
      return new Response(JSON.stringify({
        success: false,
        code: "no_google_connection",
        error: "אין חיבור פעיל ל-Google. התחבר עם חשבון Google משלך מהאינטגרציות.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get spreadsheet metadata (sheet names + title)
    const metaRes = await fetch(
      `${auth.baseUrl}/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties(title,sheetId,gridProperties)`,
      { headers: auth.headers },
    );
    const meta = await metaRes.json();
    if (!metaRes.ok) {
      // Map common Google Sheets errors to friendly, actionable messages.
      const status = metaRes.status;
      const gErr = meta?.error?.status || meta?.error?.message || "";
      if (status === 403 || /PERMISSION_DENIED/i.test(String(gErr))) {
        const who = auth.source === "user" ? (auth.email || "החשבון המחובר") : "חשבון Google המחובר באינטגרציות";
        return new Response(JSON.stringify({
          success: false,
          code: "permission_denied",
          connection_source: auth.source,
          connected_email: auth.email ?? null,
          spreadsheet_id: spreadsheetId,
          error: `אין הרשאה לגיליון עבור ${who}. שתף את הגיליון איתו (Viewer לפחות), או התחבר עם חשבון Google אחר.`,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (status === 404) {
        return new Response(JSON.stringify({
          success: false,
          code: "not_found",
          spreadsheet_id: spreadsheetId,
          error: "הגיליון לא נמצא. ודא שה-URL נכון ושהגיליון לא נמחק.",
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (status === 401) {
        return new Response(JSON.stringify({
          success: false,
          code: "unauthorized",
          connection_source: auth.source,
          error: auth.source === "user"
            ? "החיבור האישי ל-Google פג תוקף. התחבר מחדש."
            : "החיבור ל-Google Sheets פג תוקף. התחבר מחדש דרך Connectors.",
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
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
        `${auth.baseUrl}/spreadsheets/${spreadsheetId}/values:batchGet?ranges=${encodeURIComponent(range)}`,
        { headers: auth.headers },
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
      // Convert Excel serial dates in date-like columns for preview readability
      const dateColIdx = new Set<number>();
      headers.forEach((h, i) => {
        if (/date|תאריך|start|end|התחל|סיום/i.test(h)) dateColIdx.add(i);
      });
      sample = sample.map((row) => row.map((cell, i) => dateColIdx.has(i) ? formatExcelSerialIfApplicable(cell) : cell));
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
        connection_source: auth.source,
        connected_email: auth.email ?? null,
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