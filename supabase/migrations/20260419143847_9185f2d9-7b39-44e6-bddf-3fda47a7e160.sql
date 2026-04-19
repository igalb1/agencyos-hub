CREATE OR REPLACE FUNCTION public.trigger_linkedin_ads_auto_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT user_id FROM public.user_integrations
    WHERE provider = 'linkedin_ads' AND is_connected = true
  LOOP
    PERFORM net.http_post(
      url := 'https://llioeafzlhrjqwkjaepe.supabase.co/functions/v1/sync-linkedin-ads',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsaW9lYWZ6bGhyanF3a2phZXBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMzg0NTQsImV4cCI6MjA5MTkxNDQ1NH0.MOLKs5krnEa_KFuc2ViQdnGK-FVTjtaaQE0xIlk8Q8U'
      ),
      body := jsonb_build_object(
        'triggered_by', 'cron',
        'user_id', rec.user_id
      )
    );
  END LOOP;
END;
$function$;