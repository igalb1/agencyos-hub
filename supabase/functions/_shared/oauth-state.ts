// HMAC-signed OAuth state helpers.
// State payload is signed with SUPABASE_SERVICE_ROLE_KEY (server-only secret) so
// it cannot be forged by clients.

const encoder = new TextEncoder();

function b64urlEncode(bytes: Uint8Array): string {
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!secret) throw new Error("Missing signing secret");
  return await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signState(payload: Record<string, unknown>): Promise<string> {
  const body = b64urlEncode(encoder.encode(JSON.stringify({ ...payload, iat: Date.now() })));
  const key = await getKey();
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
  return `${body}.${b64urlEncode(sig)}`;
}

export async function verifyState<T = Record<string, unknown>>(
  state: string,
  maxAgeMs = 10 * 60 * 1000,
): Promise<T | null> {
  const parts = state.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  try {
    const key = await getKey();
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlDecode(sig),
      encoder.encode(body),
    );
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as T & { iat?: number };
    if (!payload.iat || Date.now() - payload.iat > maxAgeMs) return null;
    return payload as T;
  } catch {
    return null;
  }
}

/**
 * Validates a redirect URL against an allowlist of permitted origins.
 * Returns the URL string if valid, or null otherwise.
 */
export function validateRedirectUrl(redirectUrl: string, allowedOrigins: string[]): string | null {
  try {
    const u = new URL(redirectUrl);
    const origin = `${u.protocol}//${u.host}`;
    if (allowedOrigins.includes(origin)) return redirectUrl;
    return null;
  } catch {
    return null;
  }
}

export function getAllowedRedirectOrigins(): string[] {
  const extra = Deno.env.get("APP_ALLOWED_ORIGINS") ?? "";
  const defaults = [
    "https://agencyos-hub.lovable.app",
    "https://login.agencyos.solutions",
    "https://id-preview--f6f9f611-7917-4c2c-bede-850bccff9707.lovable.app",
    "http://localhost:3000",
    "http://localhost:5173",
    "https://localhost:3000",
  ];
  const fromEnv = extra.split(",").map((s) => s.trim()).filter(Boolean);
  return [...new Set([...defaults, ...fromEnv])];
}
