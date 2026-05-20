DROP INDEX IF EXISTS public.idx_campaigns_org_external;
ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_org_external_unique
  UNIQUE (organization_id, external_source, external_id);