
-- QA Templates table
CREATE TABLE public.qa_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.qa_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read qa templates"
  ON public.qa_templates FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members insert qa templates"
  ON public.qa_templates FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), organization_id) AND created_by = auth.uid());

CREATE POLICY "Org members update qa templates"
  ON public.qa_templates FOR UPDATE TO authenticated
  USING (is_org_member(auth.uid(), organization_id))
  WITH CHECK (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins delete qa templates"
  ON public.qa_templates FOR DELETE TO authenticated
  USING (is_org_admin(auth.uid(), organization_id));

CREATE INDEX idx_qa_templates_org ON public.qa_templates(organization_id);

CREATE TRIGGER trg_qa_templates_updated_at
  BEFORE UPDATE ON public.qa_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- QA Checklists table
CREATE TABLE public.qa_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  client_id UUID,
  client_name TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'meta',
  template_id UUID,
  template_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  checked_items JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'in_progress',
  progress INTEGER NOT NULL DEFAULT 0,
  critical_complete BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_by_name TEXT,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.qa_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read qa checklists"
  ON public.qa_checklists FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members insert qa checklists"
  ON public.qa_checklists FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), organization_id) AND created_by = auth.uid());

CREATE POLICY "Org members update qa checklists"
  ON public.qa_checklists FOR UPDATE TO authenticated
  USING (is_org_member(auth.uid(), organization_id))
  WITH CHECK (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins delete qa checklists"
  ON public.qa_checklists FOR DELETE TO authenticated
  USING (is_org_admin(auth.uid(), organization_id));

CREATE INDEX idx_qa_checklists_org ON public.qa_checklists(organization_id);
CREATE INDEX idx_qa_checklists_client ON public.qa_checklists(client_id);
CREATE INDEX idx_qa_checklists_status ON public.qa_checklists(status);

CREATE TRIGGER trg_qa_checklists_updated_at
  BEFORE UPDATE ON public.qa_checklists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.qa_checklists;
