CREATE TABLE public.campaign_custom_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'text' CHECK (type IN ('text','number')),
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ccc_org ON public.campaign_custom_columns(organization_id);

ALTER TABLE public.campaign_custom_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read custom columns" ON public.campaign_custom_columns
  FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members insert custom columns" ON public.campaign_custom_columns
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members update custom columns" ON public.campaign_custom_columns
  FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org admins delete custom columns" ON public.campaign_custom_columns
  FOR DELETE TO authenticated USING (public.is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER trg_ccc_updated_at BEFORE UPDATE ON public.campaign_custom_columns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.campaign_custom_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  column_id uuid NOT NULL REFERENCES public.campaign_custom_columns(id) ON DELETE CASCADE,
  value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, column_id)
);

CREATE INDEX idx_ccv_org ON public.campaign_custom_values(organization_id);
CREATE INDEX idx_ccv_campaign ON public.campaign_custom_values(campaign_id);

ALTER TABLE public.campaign_custom_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read custom values" ON public.campaign_custom_values
  FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members insert custom values" ON public.campaign_custom_values
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members update custom values" ON public.campaign_custom_values
  FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members delete custom values" ON public.campaign_custom_values
  FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));

CREATE TRIGGER trg_ccv_updated_at BEFORE UPDATE ON public.campaign_custom_values
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();