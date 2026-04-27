ALTER TABLE public.client_sheet_sync_configs
  ADD COLUMN IF NOT EXISTS sync_mode text NOT NULL DEFAULT 'flat';

ALTER TABLE public.client_sheet_sync_configs
  DROP CONSTRAINT IF EXISTS client_sheet_sync_configs_sync_mode_check;

ALTER TABLE public.client_sheet_sync_configs
  ADD CONSTRAINT client_sheet_sync_configs_sync_mode_check
  CHECK (sync_mode IN ('flat', 'hierarchical'));

ALTER TABLE public.client_sheet_sync_logs
  ADD COLUMN IF NOT EXISTS campaigns_created integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS campaigns_updated integer DEFAULT 0;