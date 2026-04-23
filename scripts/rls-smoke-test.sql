-- =====================================================================
-- RLS Smoke Test: workspace (organization) isolation
--
-- Seeds two orgs (A and B) with one member each and one row in every
-- tenant-scoped table, then asserts:
--   1. User A sees ONLY Org A rows in clients/projects/campaigns/tasks.
--   2. User A cannot INSERT a row pointing at Org B (RLS blocks it).
--   3. User A cannot UPDATE or DELETE Org B's rows.
--   4. Anonymous role sees zero rows in any tenant table.
-- Any violation aborts the run with a non-zero exit code.
-- =====================================================================

\set ON_ERROR_STOP on
BEGIN;

-- Reset any prior state
TRUNCATE public.tasks, public.campaigns, public.projects, public.clients,
         public.organization_members, public.organizations RESTART IDENTITY CASCADE;
DELETE FROM auth.users;

-- Seed users + orgs
INSERT INTO auth.users (id, email) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@test.dev'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@test.dev');

INSERT INTO public.organizations (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Org A'),
  ('22222222-2222-2222-2222-222222222222', 'Org B');

INSERT INTO public.organization_members (organization_id, user_id, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'owner');

INSERT INTO public.clients (id, organization_id, name) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccc01', '11111111-1111-1111-1111-111111111111', 'Client A'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc02', '22222222-2222-2222-2222-222222222222', 'Client B');

INSERT INTO public.projects (id, organization_id, client_id, name) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddd01', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccc01', 'Proj A'),
  ('dddddddd-dddd-dddd-dddd-dddddddddd02', '22222222-2222-2222-2222-222222222222', 'cccccccc-cccc-cccc-cccc-cccccccccc02', 'Proj B');

INSERT INTO public.campaigns (id, organization_id, client_id, project_id, name, status) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccc01', 'dddddddd-dddd-dddd-dddd-dddddddddd01', 'Camp A', 'Planned'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', '22222222-2222-2222-2222-222222222222', 'cccccccc-cccc-cccc-cccc-cccccccccc02', 'dddddddd-dddd-dddd-dddd-dddddddddd02', 'Camp B', 'Planned');

INSERT INTO public.tasks (id, organization_id, title) VALUES
  ('ffffffff-ffff-ffff-ffff-ffffffffff01', '11111111-1111-1111-1111-111111111111', 'Task A'),
  ('ffffffff-ffff-ffff-ffff-ffffffffff02', '22222222-2222-2222-2222-222222222222', 'Task B');

COMMIT;

-- ---------- Helper: assert(label, condition) ----------
CREATE OR REPLACE FUNCTION pg_temp.assert(label text, ok boolean) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT ok THEN
    RAISE EXCEPTION 'RLS-SMOKE FAIL: %', label;
  ELSE
    RAISE NOTICE 'ok: %', label;
  END IF;
END $$;

-- ===================== Act as User A (Org A) =====================
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

-- 1. Reads scoped to Org A only
SELECT pg_temp.assert('clients: only Org A visible',
  (SELECT count(*) = 1 AND bool_and(organization_id = '11111111-1111-1111-1111-111111111111') FROM public.clients));
SELECT pg_temp.assert('projects: only Org A visible',
  (SELECT count(*) = 1 AND bool_and(organization_id = '11111111-1111-1111-1111-111111111111') FROM public.projects));
SELECT pg_temp.assert('campaigns: only Org A visible',
  (SELECT count(*) = 1 AND bool_and(organization_id = '11111111-1111-1111-1111-111111111111') FROM public.campaigns));
SELECT pg_temp.assert('tasks: only Org A visible',
  (SELECT count(*) = 1 AND bool_and(organization_id = '11111111-1111-1111-1111-111111111111') FROM public.tasks));

-- 2. INSERT into Org B must fail
DO $$
DECLARE blocked boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.clients (organization_id, name)
    VALUES ('22222222-2222-2222-2222-222222222222', 'Hijack');
  EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
    blocked := true;
  END;
  PERFORM pg_temp.assert('insert into Org B rejected', blocked);
END $$;

-- 3. UPDATE / DELETE Org B rows must affect 0 rows
DO $$
DECLARE n int;
BEGIN
  UPDATE public.campaigns SET name = 'pwned'
   WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02';
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.assert('update on Org B campaign blocked (0 rows)', n = 0);

  DELETE FROM public.tasks WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffff02';
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.assert('delete on Org B task blocked (0 rows)', n = 0);
END $$;

-- ===================== Act as anon =====================
RESET ROLE;
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claim.role', 'anon', true);

SELECT pg_temp.assert('anon sees zero clients',   (SELECT count(*) = 0 FROM public.clients));
SELECT pg_temp.assert('anon sees zero projects',  (SELECT count(*) = 0 FROM public.projects));
SELECT pg_temp.assert('anon sees zero campaigns', (SELECT count(*) = 0 FROM public.campaigns));
SELECT pg_temp.assert('anon sees zero tasks',     (SELECT count(*) = 0 FROM public.tasks));

RESET ROLE;
\echo '✅ RLS smoke test passed: workspace isolation verified.'
