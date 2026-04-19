-- LinkedIn Ads campaigns table
CREATE TABLE public.linkedin_ads_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  linkedin_account_id text NOT NULL,
  campaign_id text NOT NULL,
  campaign_name text NOT NULL,
  status text,
  campaign_type text,
  daily_budget_amount numeric DEFAULT 0,
  total_budget_amount numeric DEFAULT 0,
  currency_code text,
  impressions bigint DEFAULT 0,
  clicks bigint DEFAULT 0,
  cost_in_local_currency numeric DEFAULT 0,
  conversions numeric DEFAULT 0,
  conversion_value_in_local_currency numeric DEFAULT 0,
  ctr numeric DEFAULT 0,
  date_range_start date NOT NULL,
  date_range_end date NOT NULL,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, linkedin_account_id, campaign_id, date_range_start, date_range_end)
);

ALTER TABLE public.linkedin_ads_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own linkedin ads campaigns"
  ON public.linkedin_ads_campaigns FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own linkedin ads campaigns"
  ON public.linkedin_ads_campaigns FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own linkedin ads campaigns"
  ON public.linkedin_ads_campaigns FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own linkedin ads campaigns"
  ON public.linkedin_ads_campaigns FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages linkedin ads campaigns"
  ON public.linkedin_ads_campaigns FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER update_linkedin_ads_campaigns_updated_at
  BEFORE UPDATE ON public.linkedin_ads_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- LinkedIn Ads sync log
CREATE TABLE public.linkedin_ads_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  linkedin_account_id text,
  status text NOT NULL,
  campaigns_synced integer DEFAULT 0,
  date_range_start date,
  date_range_end date,
  error_message text,
  triggered_by text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.linkedin_ads_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own linkedin sync log"
  ON public.linkedin_ads_sync_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages linkedin sync log"
  ON public.linkedin_ads_sync_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX idx_linkedin_ads_campaigns_user ON public.linkedin_ads_campaigns(user_id, date_range_end DESC);
CREATE INDEX idx_linkedin_ads_sync_log_user ON public.linkedin_ads_sync_log(user_id, created_at DESC);