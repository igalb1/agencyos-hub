
-- facebook_ads_campaigns
CREATE TABLE public.facebook_ads_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  facebook_account_id text NOT NULL,
  account_name text,
  campaign_id text NOT NULL,
  campaign_name text NOT NULL,
  status text,
  objective text,
  currency_code text,
  daily_budget numeric DEFAULT 0,
  lifetime_budget numeric DEFAULT 0,
  impressions bigint DEFAULT 0,
  clicks bigint DEFAULT 0,
  spend numeric DEFAULT 0,
  conversions numeric DEFAULT 0,
  conversion_value numeric DEFAULT 0,
  ctr numeric DEFAULT 0,
  date_range_start date NOT NULL,
  date_range_end date NOT NULL,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, facebook_account_id, campaign_id, date_range_start, date_range_end)
);

ALTER TABLE public.facebook_ads_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages facebook ads campaigns"
  ON public.facebook_ads_campaigns FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users view own facebook ads campaigns"
  ON public.facebook_ads_campaigns FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own facebook ads campaigns"
  ON public.facebook_ads_campaigns FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own facebook ads campaigns"
  ON public.facebook_ads_campaigns FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users delete own facebook ads campaigns"
  ON public.facebook_ads_campaigns FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_fb_campaigns_updated_at
BEFORE UPDATE ON public.facebook_ads_campaigns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- facebook_ads_sync_log
CREATE TABLE public.facebook_ads_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  facebook_account_id text,
  status text NOT NULL,
  campaigns_synced integer DEFAULT 0,
  date_range_start date,
  date_range_end date,
  error_message text,
  triggered_by text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facebook_ads_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages fb sync log"
  ON public.facebook_ads_sync_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users view own fb sync log"
  ON public.facebook_ads_sync_log FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- Auto sync trigger function
CREATE OR REPLACE FUNCTION public.trigger_facebook_ads_auto_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  svc text;
BEGIN
  svc := public.get_cron_service_role_key();
  IF svc IS NULL OR length(svc) < 20 OR svc = 'PLACEHOLDER_REPLACE_ME' THEN
    RAISE NOTICE 'cron_service_role_key not configured; skipping facebook ads cron sync';
    RETURN;
  END IF;

  FOR rec IN
    SELECT user_id FROM public.user_integrations
    WHERE provider = 'facebook_ads' AND is_connected = true
  LOOP
    PERFORM net.http_post(
      url := 'https://llioeafzlhrjqwkjaepe.supabase.co/functions/v1/sync-facebook-ads',
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
$$;

-- Schedule cron daily at 03:30 UTC
SELECT cron.schedule(
  'facebook-ads-auto-sync-daily',
  '30 3 * * *',
  $$ SELECT public.trigger_facebook_ads_auto_sync(); $$
);
