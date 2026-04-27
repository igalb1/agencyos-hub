CREATE TABLE public.client_sheet_sync_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  created_by uuid NOT NULL,
  name text NOT NULL DEFAULT 'Clients sync',
  spreadsheet_id text NOT NULL,
  sheet_name text NOT NULL DEFAULT 'Sheet1',
  range_a1 text NOT NULL DEFAULT 'A1:Z1000',
  header_row integer NOT NULL DEFAULT 1,
  column_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  match_field text NOT NULL DEFAULT 'name',
  frequency text NOT NULL DEFAULT 'manual',
  is_active boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_sheet_sync_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read sheet sync configs"
  ON public.client_sheet_sync_configs FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members insert sheet sync configs"
  ON public.client_sheet_sync_configs FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), organization_id) AND created_by = auth.uid());

CREATE POLICY "Org members update sheet sync configs"
  ON public.client_sheet_sync_configs FOR UPDATE TO authenticated
  USING (is_org_member(auth.uid(), organization_id))
  WITH CHECK (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins delete sheet sync configs"
  ON public.client_sheet_sync_configs FOR DELETE TO authenticated
  USING (is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Service role manages sheet sync configs"
  ON public.client_sheet_sync_configs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER update_client_sheet_sync_configs_updated_at
  BEFORE UPDATE ON public.client_sheet_sync_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_sheet_sync_configs_org ON public.client_sheet_sync_configs(organization_id);
CREATE INDEX idx_sheet_sync_configs_next_run ON public.client_sheet_sync_configs(next_run_at) WHERE is_active = true AND frequency <> 'manual';

CREATE TABLE public.client_sheet_sync_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id uuid NOT NULL REFERENCES public.client_sheet_sync_configs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  triggered_by text NOT NULL DEFAULT 'manual',
  status text NOT NULL,
  rows_read integer DEFAULT 0,
  clients_created integer DEFAULT 0,
  clients_updated integer DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_sheet_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read sheet sync logs"
  ON public.client_sheet_sync_logs FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Service role manages sheet sync logs"
  ON public.client_sheet_sync_logs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX idx_sheet_sync_logs_config ON public.client_sheet_sync_logs(config_id, created_at DESC);