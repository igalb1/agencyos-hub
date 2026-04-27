ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS objective text NOT NULL DEFAULT 'leads';

-- Allowed objectives (open set — we use text not enum so users can extend)
ALTER TABLE public.campaigns
DROP CONSTRAINT IF EXISTS campaigns_objective_check;

ALTER TABLE public.campaigns
ADD CONSTRAINT campaigns_objective_check
CHECK (objective IN ('leads','sales','video','awareness','traffic','engagement','app','other'));

CREATE INDEX IF NOT EXISTS idx_campaigns_objective ON public.campaigns(objective);