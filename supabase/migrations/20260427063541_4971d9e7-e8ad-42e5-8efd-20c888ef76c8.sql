-- Store the service-role key in Vault (replace value with current SUPABASE_SERVICE_ROLE_KEY).
-- We do NOT have the value in this migration; instead we read it from a setting if present,
-- otherwise we leave any pre-existing vault entry alone. Operator must populate it once.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'cron_service_role_key') THEN
    -- Insert an empty placeholder; the trigger functions will refuse to call if empty.
    PERFORM vault.create_secret('PLACEHOLDER_REPLACE_ME', 'cron_service_role_key',
      'Service role key used by DB cron triggers to invoke edge functions');
  END IF;
END $$;

-- Helper to fetch the cron key (security definer, only callable by superuser/definer chain)
CREATE OR REPLACE FUNCTION public.get_cron_service_role_key()
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE k text;
BEGIN
  SELECT decrypted_secret INTO k
  FROM vault.decrypted_secrets
  WHERE name = 'cron_service_role_key'
  LIMIT 1;
  RETURN k;
END;
$$;
REVOKE ALL ON FUNCTION public.get_cron_service_role_key() FROM PUBLIC, anon, authenticated;

-- Update Google Ads cron trigger to use service role key
CREATE OR REPLACE FUNCTION public.trigger_google_ads_auto_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rec record;
  svc text;
BEGIN
  svc := public.get_cron_service_role_key();
  IF svc IS NULL OR length(svc) < 20 OR svc = 'PLACEHOLDER_REPLACE_ME' THEN
    RAISE NOTICE 'cron_service_role_key not configured; skipping google ads cron sync';
    RETURN;
  END IF;

  FOR rec IN
    SELECT user_id FROM public.user_integrations
    WHERE provider = 'google_ads' AND is_connected = true
  LOOP
    PERFORM net.http_post(
      url := 'https://llioeafzlhrjqwkjaepe.supabase.co/functions/v1/sync-google-ads',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || svc
      ),
      body := jsonb_build_object(
        'triggered_by', 'cron',
        'user_id', rec.user_id
      )
    );
  END LOOP;
END;
$function$;

-- Update LinkedIn Ads cron trigger to use service role key
CREATE OR REPLACE FUNCTION public.trigger_linkedin_ads_auto_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rec record;
  svc text;
BEGIN
  svc := public.get_cron_service_role_key();
  IF svc IS NULL OR length(svc) < 20 OR svc = 'PLACEHOLDER_REPLACE_ME' THEN
    RAISE NOTICE 'cron_service_role_key not configured; skipping linkedin ads cron sync';
    RETURN;
  END IF;

  FOR rec IN
    SELECT user_id FROM public.user_integrations
    WHERE provider = 'linkedin_ads' AND is_connected = true
  LOOP
    PERFORM net.http_post(
      url := 'https://llioeafzlhrjqwkjaepe.supabase.co/functions/v1/sync-linkedin-ads',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || svc
      ),
      body := jsonb_build_object(
        'triggered_by', 'cron',
        'user_id', rec.user_id
      )
    );
  END LOOP;
END;
$function$;