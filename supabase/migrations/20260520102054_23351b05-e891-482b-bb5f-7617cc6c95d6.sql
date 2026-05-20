ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS external_source text,
  ADD COLUMN IF NOT EXISTS external_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_campaigns_org_external
  ON public.campaigns (organization_id, external_source, external_id)
  WHERE external_id IS NOT NULL;