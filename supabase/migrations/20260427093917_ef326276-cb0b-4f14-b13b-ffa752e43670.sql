-- Helper to upsert the cron_service_role_key in Supabase Vault.
-- Only callable by service_role (the seed-cron-key edge function uses service_role client).
CREATE OR REPLACE FUNCTION public.seed_cron_service_role_key(_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  existing_id uuid;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Only service role can seed cron service role key';
  END IF;

  IF _key IS NULL OR length(_key) < 20 THEN
    RAISE EXCEPTION 'Invalid key value';
  END IF;

  SELECT id INTO existing_id FROM vault.secrets WHERE name = 'cron_service_role_key' LIMIT 1;

  IF existing_id IS NULL THEN
    PERFORM vault.create_secret(_key, 'cron_service_role_key', 'Service role key used by pg_cron jobs to invoke ad-sync edge functions');
  ELSE
    PERFORM vault.update_secret(existing_id, _key, 'cron_service_role_key', 'Service role key used by pg_cron jobs to invoke ad-sync edge functions');
  END IF;
END;
$$;

-- Lock down: revoke from public/auth, only service_role can call it
REVOKE ALL ON FUNCTION public.seed_cron_service_role_key(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.seed_cron_service_role_key(text) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.seed_cron_service_role_key(text) TO service_role;