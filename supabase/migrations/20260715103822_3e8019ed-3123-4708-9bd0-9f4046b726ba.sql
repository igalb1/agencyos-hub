
-- Cancel existing cron job (if any) and drop old tables
DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'google-ads-daily-sync' LIMIT 1;
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DELETE FROM public.user_integrations WHERE provider = 'google_ads';
DROP TABLE IF EXISTS public.google_ads_campaigns CASCADE;
DROP TABLE IF EXISTS public.google_ads_sync_log CASCADE;

-- Recreate campaigns table
CREATE TABLE public.google_ads_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  login_customer_id TEXT,
  google_customer_id TEXT NOT NULL,
  account_name TEXT,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  status TEXT,
  advertising_channel_type TEXT,
  currency_code TEXT,
  budget_amount NUMERIC DEFAULT 0,
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  cost NUMERIC NOT NULL DEFAULT 0,
  conversions NUMERIC NOT NULL DEFAULT 0,
  conversion_value NUMERIC NOT NULL DEFAULT 0,
  ctr NUMERIC NOT NULL DEFAULT 0,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, google_customer_id, campaign_id, date_range_start, date_range_end)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_ads_campaigns TO authenticated;
GRANT ALL ON public.google_ads_campaigns TO service_role;

ALTER TABLE public.google_ads_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gac_select_own" ON public.google_ads_campaigns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "gac_insert_own" ON public.google_ads_campaigns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gac_update_own" ON public.google_ads_campaigns FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "gac_delete_own" ON public.google_ads_campaigns FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_gac_updated BEFORE UPDATE ON public.google_ads_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_gac_user ON public.google_ads_campaigns(user_id);
CREATE INDEX idx_gac_customer ON public.google_ads_campaigns(user_id, google_customer_id);

-- Recreate sync log
CREATE TABLE public.google_ads_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_customer_id TEXT,
  status TEXT NOT NULL,
  campaigns_synced INTEGER,
  accounts_synced INTEGER,
  date_range_start DATE,
  date_range_end DATE,
  error_message TEXT,
  triggered_by TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.google_ads_sync_log TO authenticated;
GRANT ALL ON public.google_ads_sync_log TO service_role;

ALTER TABLE public.google_ads_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gasl_select_own" ON public.google_ads_sync_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "gasl_insert_own" ON public.google_ads_sync_log FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_gasl_user_created ON public.google_ads_sync_log(user_id, created_at DESC);

-- Reschedule daily cron at 04:00 UTC
SELECT cron.schedule(
  'google-ads-daily-sync',
  '0 4 * * *',
  $$ SELECT public.trigger_google_ads_auto_sync(); $$
);
