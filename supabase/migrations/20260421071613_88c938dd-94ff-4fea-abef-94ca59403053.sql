ALTER TABLE public.organizations 
ALTER COLUMN trial_ends_at SET DEFAULT (now() + '14 days'::interval);