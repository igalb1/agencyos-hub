ALTER TABLE public.campaign_custom_columns
  DROP CONSTRAINT IF EXISTS campaign_custom_columns_type_check;

ALTER TABLE public.campaign_custom_columns
  ADD CONSTRAINT campaign_custom_columns_type_check
  CHECK (type IN ('text','number','formula'));

ALTER TABLE public.campaign_custom_columns
  ADD COLUMN IF NOT EXISTS formula text;