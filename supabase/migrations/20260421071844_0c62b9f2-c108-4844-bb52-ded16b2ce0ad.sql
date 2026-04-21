ALTER TABLE public.organizations 
ALTER COLUMN trial_ends_at SET DEFAULT (now() + '28 days'::interval);