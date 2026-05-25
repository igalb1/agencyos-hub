
-- Remove Google Ads integration
-- Unschedule cron job if exists
DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'sync-google-ads-daily';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
END $$;

-- Drop tables
DROP TABLE IF EXISTS public.google_ads_campaigns CASCADE;
DROP TABLE IF EXISTS public.google_ads_sync_log CASCADE;

-- Remove stored google_ads integration tokens
DELETE FROM public.user_integrations WHERE provider = 'google_ads';
