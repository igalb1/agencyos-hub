
ALTER TABLE public.organizations
ADD COLUMN trial_ends_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '60 days'),
ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

-- Set trial for existing organizations
UPDATE public.organizations SET trial_ends_at = now() + interval '60 days' WHERE trial_ends_at IS NULL;
