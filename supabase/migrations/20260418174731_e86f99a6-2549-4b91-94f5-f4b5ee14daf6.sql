-- Table to store synced Google Ads campaign data
CREATE TABLE public.google_ads_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  google_account_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  status TEXT,
  advertising_channel_type TEXT,
  daily_budget_micros BIGINT,
  -- Metrics
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  cost_micros BIGINT DEFAULT 0,
  conversions NUMERIC DEFAULT 0,
  conversions_value NUMERIC DEFAULT 0,
  ctr NUMERIC DEFAULT 0,
  average_cpc_micros BIGINT DEFAULT 0,
  -- Report range
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  last_synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, google_account_id, campaign_id, date_range_start, date_range_end)
);

CREATE INDEX idx_gads_campaigns_user ON public.google_ads_campaigns(user_id);
CREATE INDEX idx_gads_campaigns_account ON public.google_ads_campaigns(user_id, google_account_id);

ALTER TABLE public.google_ads_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own google ads campaigns"
  ON public.google_ads_campaigns FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own google ads campaigns"
  ON public.google_ads_campaigns FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own google ads campaigns"
  ON public.google_ads_campaigns FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own google ads campaigns"
  ON public.google_ads_campaigns FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages google ads campaigns"
  ON public.google_ads_campaigns FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER update_gads_campaigns_updated_at
  BEFORE UPDATE ON public.google_ads_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table to log sync attempts
CREATE TABLE public.google_ads_sync_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  google_account_id TEXT,
  status TEXT NOT NULL, -- 'success' | 'error'
  campaigns_synced INTEGER DEFAULT 0,
  date_range_start DATE,
  date_range_end DATE,
  error_message TEXT,
  triggered_by TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'cron'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_gads_sync_log_user ON public.google_ads_sync_log(user_id, created_at DESC);

ALTER TABLE public.google_ads_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own sync log"
  ON public.google_ads_sync_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages sync log"
  ON public.google_ads_sync_log FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');