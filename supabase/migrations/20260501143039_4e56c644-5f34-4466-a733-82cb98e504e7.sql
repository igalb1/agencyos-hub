-- Ads belonging to campaigns (for QA per-ad)
CREATE TABLE public.campaign_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  name text NOT NULL,
  format text,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_ads_campaign ON public.campaign_ads(campaign_id);
CREATE INDEX idx_campaign_ads_org ON public.campaign_ads(organization_id);

ALTER TABLE public.campaign_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read campaign ads"
  ON public.campaign_ads FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members insert campaign ads"
  ON public.campaign_ads FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), organization_id) AND created_by = auth.uid());

CREATE POLICY "Org members update campaign ads"
  ON public.campaign_ads FOR UPDATE TO authenticated
  USING (is_org_member(auth.uid(), organization_id))
  WITH CHECK (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins delete campaign ads"
  ON public.campaign_ads FOR DELETE TO authenticated
  USING (is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER trg_campaign_ads_updated
  BEFORE UPDATE ON public.campaign_ads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add ad linkage + scope to qa_checklists
ALTER TABLE public.qa_checklists
  ADD COLUMN IF NOT EXISTS ad_id uuid,
  ADD COLUMN IF NOT EXISTS ad_name text,
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'ad';
-- scope: 'ad' = checks one ad inside a campaign (default going forward)
--        'campaign' = legacy whole-campaign check (existing rows)

CREATE INDEX IF NOT EXISTS idx_qa_checklists_ad ON public.qa_checklists(ad_id);
CREATE INDEX IF NOT EXISTS idx_qa_checklists_campaign_lookup
  ON public.qa_checklists(organization_id, campaign_name);