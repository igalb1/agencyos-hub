
CREATE TABLE public.google_ads_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  google_customer_id text NOT NULL,
  account_name text,
  campaign_id text NOT NULL,
  campaign_name text NOT NULL,
  status text,
  advertising_channel_type text,
  currency_code text,
  budget_amount numeric DEFAULT 0,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  cost numeric NOT NULL DEFAULT 0,
  conversions numeric NOT NULL DEFAULT 0,
  conversion_value numeric NOT NULL DEFAULT 0,
  ctr numeric NOT NULL DEFAULT 0,
  date_range_start date NOT NULL,
  date_range_end date NOT NULL,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, google_customer_id, campaign_id, date_range_start, date_range_end)
);

ALTER TABLE public.google_ads_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own google ads campaigns" ON public.google_ads_campaigns
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own google ads campaigns" ON public.google_ads_campaigns
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own google ads campaigns" ON public.google_ads_campaigns
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own google ads campaigns" ON public.google_ads_campaigns
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_google_ads_campaigns_updated
BEFORE UPDATE ON public.google_ads_campaigns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.google_ads_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  google_customer_id text,
  status text NOT NULL,
  campaigns_synced integer,
  date_range_start date,
  date_range_end date,
  error_message text,
  triggered_by text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_ads_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own google ads logs" ON public.google_ads_sync_log
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own google ads logs" ON public.google_ads_sync_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

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

SELECT cron.schedule(
  'google-ads-daily-sync',
  '0 4 * * *',
  $$SELECT public.trigger_google_ads_auto_sync();$$
);
