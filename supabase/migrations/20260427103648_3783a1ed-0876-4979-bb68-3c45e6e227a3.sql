CREATE OR REPLACE FUNCTION public.trigger_client_sheet_auto_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec record;
  svc text;
BEGIN
  svc := public.get_cron_service_role_key();
  IF svc IS NULL OR length(svc) < 20 OR svc = 'PLACEHOLDER_REPLACE_ME' THEN
    RAISE NOTICE 'cron_service_role_key not configured; skipping client sheet cron sync';
    RETURN;
  END IF;

  FOR rec IN
    SELECT id FROM public.client_sheet_sync_configs
    WHERE is_active = true
      AND frequency <> 'manual'
      AND (next_run_at IS NULL OR next_run_at <= now())
  LOOP
    PERFORM net.http_post(
      url := 'https://llioeafzlhrjqwkjaepe.supabase.co/functions/v1/sync-clients-from-sheet',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || svc
      ),
      body := jsonb_build_object(
        'triggered_by', 'cron',
        'config_id', rec.id
      )
    );
  END LOOP;
END;
$$;