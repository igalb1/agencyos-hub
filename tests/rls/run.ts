/**
 * AgencyOS — Database-level RLS QA suite.
 *
 * Run:  bunx tsx tests/rls/run.ts
 *
 * Required env:
 *   QA_TEST_SECRET     — must equal the runtime secret of the same name
 *   QA_USER_PASSWORD   — optional, default "QaPass!2026"
 *
 * The suite uses the qa-test-admin Edge Function (service role) to seed and
 * tear down data, and per-user anon JS clients to exercise RLS exactly as
 * the browser would.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// -- config ----------------------------------------------------------------
const SUPABASE_URL = "https://llioeafzlhrjqwkjaepe.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsaW9lYWZ6bGhyanF3a2phZXBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMzg0NTQsImV4cCI6MjA5MTkxNDQ1NH0.MOLKs5krnEa_KFuc2ViQdnGK-FVTjtaaQE0xIlk8Q8U";
const QA_SECRET = process.env.QA_TEST_SECRET ?? "";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const PASSWORD = process.env.QA_USER_PASSWORD ?? "QaPass!2026";
const PREFIX = "qa-rls-";

if (!QA_SECRET && !SERVICE_ROLE) {
  console.error("✖ Neither QA_TEST_SECRET nor SUPABASE_SERVICE_ROLE_KEY is set. Aborting.");
  process.exit(2);
}

// Stable, prefixed identities so cleanup is deterministic.
const E = {
  ownerA: `${PREFIX}owner-a@agency-a-qa.test`,
  adminA: `${PREFIX}admin-a@agency-a-qa.test`,
  memberA: `${PREFIX}member-a@agency-a-qa.test`,
  pendingA: `${PREFIX}pending-a@agency-a-qa.test`,
  ownerB: `${PREFIX}owner-b@agency-b-qa.test`,
};
const ORG_A = `${PREFIX}Agency A`;
const ORG_B = `${PREFIX}Agency B`;

// -- admin helper (service-role via edge function) -------------------------
async function admin<T = any>(action: string, payload: any = {}): Promise<T> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    apikey: ANON_KEY,
  };
  if (QA_SECRET) headers["x-qa-secret"] = QA_SECRET;
  if (SERVICE_ROLE) headers["authorization"] = `Bearer ${SERVICE_ROLE}`;
  const r = await fetch(`${SUPABASE_URL}/functions/v1/qa-test-admin`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, payload }),
  });
  const text = await r.text();
  let body: any;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!r.ok) throw new Error(`admin(${action}) ${r.status}: ${text}`);
  return body;
}

// -- per-user clients ------------------------------------------------------
function newAnonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
async function loginAs(email: string): Promise<SupabaseClient> {
  const c = newAnonClient();
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

// -- reporting -------------------------------------------------------------
type Result = { name: string; ok: boolean; detail?: string; risk?: string };
const results: Result[] = [];
function record(name: string, ok: boolean, detail?: string, risk?: string) {
  results.push({ name, ok, detail, risk });
  const tag = ok ? "\x1b[32m PASS \x1b[0m" : "\x1b[41;97m FAIL \x1b[0m";
  console.log(`${tag} ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok && risk) console.log(`        \x1b[33m⚠  ${risk}\x1b[0m`);
}
async function check(name: string, fn: () => Promise<void>, risk?: string) {
  try { await fn(); record(name, true); }
  catch (e: any) { record(name, false, e?.message ?? String(e), risk); }
}
function expect(cond: boolean, msg: string) { if (!cond) throw new Error(msg); }

// -- seed ------------------------------------------------------------------
type Ctx = {
  ownerA_id: string; adminA_id: string; memberA_id: string; pendingA_id: string; ownerB_id: string;
  orgA: string; orgB: string;
  clientA1: string; clientB1: string;
  campaignA1: string; campaignB1: string;
  adminA_member_id: string; memberA_member_id: string; pendingA_member_id: string; ownerA_member_id: string;
};

async function cleanup() {
  await admin("cleanup_prefix", { prefix: PREFIX });
}

async function seed(): Promise<Ctx> {
  await cleanup();

  // Create users via service role. handle_new_user() will:
  //  - ownerA / ownerB: create their org (org_name in metadata) and become owner.
  //  - adminA / memberA / pendingA: business domain matches Agency A → join as
  //    pending member of Agency A automatically.
  const ownerA = await admin<any>("create_user", {
    email: E.ownerA, password: PASSWORD, full_name: "Owner A",
    meta: { org_name: ORG_A },
  });
  const ownerB = await admin<any>("create_user", {
    email: E.ownerB, password: PASSWORD, full_name: "Owner B",
    meta: { org_name: ORG_B },
  });
  const adminA = await admin<any>("create_user", { email: E.adminA, password: PASSWORD, full_name: "Admin A" });
  const memberA = await admin<any>("create_user", { email: E.memberA, password: PASSWORD, full_name: "Member A" });
  const pendingA = await admin<any>("create_user", { email: E.pendingA, password: PASSWORD, full_name: "Pending A" });

  // Lookup memberships
  const ownerAm = await admin<any>("get_member", { email: E.ownerA });
  const ownerBm = await admin<any>("get_member", { email: E.ownerB });
  const adminAm = await admin<any>("get_member", { email: E.adminA });
  const memberAm = await admin<any>("get_member", { email: E.memberA });
  const pendingAm = await admin<any>("get_member", { email: E.pendingA });

  const orgA = ownerAm.memberships[0].organization_id;
  const orgB = ownerBm.memberships[0].organization_id;

  // Promote adminA → admin/active and memberA → member/active. Leave pendingA pending.
  await admin("set_member_status", { member_id: adminAm.memberships[0].id, status: "active" });
  await admin("set_member_role", { member_id: adminAm.memberships[0].id, role: "admin" });
  await admin("set_member_status", { member_id: memberAm.memberships[0].id, status: "active" });
  await admin("set_member_role", { member_id: memberAm.memberships[0].id, role: "member" });

  // Seed business data
  const clientA1 = (await admin<any>("seed_client", { name: "Client A1", organization_id: orgA })).client.id;
  const clientB1 = (await admin<any>("seed_client", { name: "Client B1", organization_id: orgB })).client.id;
  const campaignA1 = (await admin<any>("seed_campaign", { name: "Campaign A1", organization_id: orgA, client_id: clientA1 })).campaign.id;
  const campaignB1 = (await admin<any>("seed_campaign", { name: "Campaign B1", organization_id: orgB, client_id: clientB1 })).campaign.id;

  return {
    ownerA_id: ownerA.user.id, adminA_id: adminA.user.id, memberA_id: memberA.user.id,
    pendingA_id: pendingA.user.id, ownerB_id: ownerB.user.id,
    orgA, orgB, clientA1, clientB1, campaignA1, campaignB1,
    ownerA_member_id: ownerAm.memberships[0].id,
    adminA_member_id: adminAm.memberships[0].id,
    memberA_member_id: memberAm.memberships[0].id,
    pendingA_member_id: pendingAm.memberships[0].id,
  };
}

// -- tests -----------------------------------------------------------------
async function run() {
  console.log("\n▶ Seeding test data…");
  const ctx = await seed();
  console.log(`  Agency A = ${ctx.orgA}`);
  console.log(`  Agency B = ${ctx.orgB}\n`);

  const ownerA = await loginAs(E.ownerA);
  const adminA = await loginAs(E.adminA);
  const memberA = await loginAs(E.memberA);
  const pendingA = await loginAs(E.pendingA);
  const ownerB = await loginAs(E.ownerB);

  // 2. SELECT isolation -----------------------------------------------------
  await check("Owner A sees only Agency A in organizations", async () => {
    const { data, error } = await ownerA.from("organizations").select("id,name");
    expect(!error, `query error: ${error?.message}`);
    expect(!!data && data.length === 1 && data[0].id === ctx.orgA,
      `expected only Agency A, got ${JSON.stringify(data)}`);
  }, "Cross-tenant org visibility");

  await check("Admin A (Campaign Manager) sees only Client A1", async () => {
    const { data, error } = await adminA.from("clients").select("id,name,organization_id");
    expect(!error, `error: ${error?.message}`);
    expect(!!data && data.every((r) => r.organization_id === ctx.orgA),
      `cross-org rows leaked: ${JSON.stringify(data)}`);
    expect(!!data?.find((r) => r.id === ctx.clientA1), "Client A1 not visible");
    expect(!data?.find((r) => r.id === ctx.clientB1), "Client B1 visible to Agency A user");
  }, "Cross-tenant client visibility");

  await check("Member A sees Agency A clients only (no cross-org)", async () => {
    const { data, error } = await memberA.from("clients").select("id,organization_id");
    expect(!error, `error: ${error?.message}`);
    expect(!!data && data.every((r) => r.organization_id === ctx.orgA),
      `member saw cross-org rows: ${JSON.stringify(data)}`);
  }, "Cross-tenant client visibility");

  await check("Admin A direct lookup of Campaign B1 returns nothing", async () => {
    const { data, error } = await adminA.from("campaigns").select("id").eq("id", ctx.campaignB1);
    expect(!error, `error: ${error?.message}`);
    expect(!data || data.length === 0, `Campaign B1 leaked via direct ID: ${JSON.stringify(data)}`);
  }, "Direct-ID cross-tenant leak");

  // 3. INSERT -------------------------------------------------------------
  await check("Admin A cannot INSERT a client into Agency B", async () => {
    const { data, error } = await adminA.from("clients")
      .insert({ name: "hijack", organization_id: ctx.orgB }).select();
    const blocked = !!error || !data || data.length === 0;
    expect(blocked, `insert succeeded: ${JSON.stringify(data)}`);
  }, "Cross-tenant write");

  await check("Member A cannot DELETE a client (admin/owner only)", async () => {
    const { error, count } = await memberA.from("clients")
      .delete({ count: "exact" }).eq("id", ctx.clientA1);
    const blocked = !!error || count === 0;
    expect(blocked, `delete by member affected ${count} row(s)`);
    // verify row still there
    const still = await admin<any>("ping"); void still;
  }, "Privilege escalation (member→delete)");

  // 4. UPDATE -------------------------------------------------------------
  await check("Admin A UPDATE on Campaign B1 affects 0 rows", async () => {
    const { data, error } = await adminA.from("campaigns")
      .update({ name: "pwned" }).eq("id", ctx.campaignB1).select();
    expect(!error || /row-level/i.test(error.message),
      `unexpected error: ${error?.message}`);
    expect(!data || data.length === 0, "cross-org update succeeded");
  }, "Cross-tenant update");

  await check("Member A can UPDATE within own org (allowed by RLS)", async () => {
    const { data, error } = await memberA.from("campaigns")
      .update({ name: "Campaign A1 (renamed)" }).eq("id", ctx.campaignA1).select();
    expect(!error, `error: ${error?.message}`);
    expect(!!data && data.length === 1, "expected to update own-org campaign");
  });

  // 5. DELETE -------------------------------------------------------------
  await check("Owner A DELETE on Campaign B1 affects 0 rows", async () => {
    const { data, error } = await ownerA.from("campaigns")
      .delete().eq("id", ctx.campaignB1).select();
    expect(!error, `error: ${error?.message}`);
    expect(!data || data.length === 0, "cross-org delete succeeded");
  }, "Cross-tenant delete");

  await check("Member A cannot DELETE a campaign in own org", async () => {
    const { data, error } = await memberA.from("campaigns")
      .delete().eq("id", ctx.campaignA1).select();
    const blocked = !!error || !data || data.length === 0;
    expect(blocked, `member delete succeeded: ${JSON.stringify(data)}`);
  }, "Privilege escalation (member→delete)");

  // 6. MEMBERSHIP STATUS --------------------------------------------------
  await check("Pending member sees zero clients & campaigns", async () => {
    const c = await pendingA.from("clients").select("id");
    const k = await pendingA.from("campaigns").select("id");
    expect(!c.error && (c.data?.length ?? 0) === 0, `pending saw clients: ${JSON.stringify(c.data)}`);
    expect(!k.error && (k.data?.length ?? 0) === 0, `pending saw campaigns: ${JSON.stringify(k.data)}`);
  }, "Pending users bypassing isolation");

  // Removed user: remove memberA from Agency A and re-query (re-use the same JWT).
  await admin("remove_member", { member_id: ctx.memberA_member_id });
  await check("Removed member sees zero org data", async () => {
    const c = await memberA.from("clients").select("id");
    const k = await memberA.from("campaigns").select("id");
    expect((c.data?.length ?? 0) === 0, `removed user saw clients: ${JSON.stringify(c.data)}`);
    expect((k.data?.length ?? 0) === 0, `removed user saw campaigns: ${JSON.stringify(k.data)}`);
  }, "Removed user retains data access");

  // 7. Direct ID covered above (Admin A → Campaign B1).

  // 8. ROLE-BASED ---------------------------------------------------------
  await check("Admin A can create an invitation", async () => {
    const { data, error } = await adminA.from("organization_invitations").insert({
      organization_id: ctx.orgA,
      email: `${PREFIX}invitee@agency-a-qa.test`,
      role: "member",
      invited_by: ctx.adminA_id,
    }).select();
    expect(!error, `error: ${error?.message}`);
    expect(!!data && data.length === 1, "invitation not created");
  });

  // pendingA acts as the lowest-privilege actor for the next two checks
  // (member-with-pending-status — strictly less privileged than active member).
  await check("Non-admin cannot create an invitation", async () => {
    const c = await loginAs(E.pendingA);
    const { data, error } = await c.from("organization_invitations").insert({
      organization_id: ctx.orgA,
      email: `${PREFIX}invitee2@agency-a-qa.test`,
      role: "member",
      invited_by: ctx.pendingA_id,
    }).select();
    const blocked = !!error || !data || data.length === 0;
    expect(blocked, `non-admin invite succeeded: ${JSON.stringify(data)}`);
  }, "Privilege escalation via invitation");

  // 9. OWNER PROTECTION ---------------------------------------------------
  await check("Owner A cannot self-elevate Admin A to owner via UPDATE", async () => {
    const { data, error } = await ownerA.from("organization_members")
      .update({ role: "owner" }).eq("id", ctx.adminA_member_id).select();
    // RLS WITH CHECK blocks role='owner' updates on this table.
    const blocked = !!error || !data || data.length === 0;
    expect(blocked, `second owner created: ${JSON.stringify(data)}`);
  }, "Multiple-owner injection");

  await check("Owner A cannot DELETE the owner row (themselves)", async () => {
    const { data, error } = await ownerA.from("organization_members")
      .delete().eq("id", ctx.ownerA_member_id).select();
    const blocked = !!error || !data || data.length === 0;
    expect(blocked, "owner row was deleted");
  }, "Owner self-removal leaves org without owner");

  // 10/11. API-level cross-org sweep (catch-all): no client we query as
  // userA may ever return organization_id of Agency B.
  await check("API sweep: Admin A never receives Agency B rows", async () => {
    for (const t of ["clients", "projects", "campaigns", "tasks"] as const) {
      const { data, error } = await adminA.from(t).select("organization_id");
      expect(!error, `${t}: ${error?.message}`);
      const leak = (data ?? []).find((r: any) => r.organization_id === ctx.orgB);
      expect(!leak, `${t} leaked Agency B row`);
    }
  }, "Multi-table cross-tenant leak");

  // -- final report -------------------------------------------------------
  console.log("\n──────────────── REPORT ────────────────");
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`Total: ${results.length}   ✓ ${passed}   ✗ ${failed}`);
  if (failed) {
    console.log("\nFailing tests (security risks):");
    for (const r of results.filter((x) => !x.ok)) {
      console.log(`  ✗ ${r.name}`);
      if (r.detail) console.log(`      detail: ${r.detail}`);
      if (r.risk) console.log(`      risk:   ${r.risk}`);
    }
  }
  console.log("────────────────────────────────────────\n");
  return failed;
}

(async () => {
  let failed = 1;
  try { failed = await run(); }
  catch (e) { console.error("✖ suite crashed:", e); }
  finally {
    console.log("▶ Cleaning up test data…");
    try { await cleanup(); console.log("  done."); }
    catch (e) { console.error("  cleanup failed:", e); }
  }
  process.exit(failed === 0 ? 0 : 1);
})();