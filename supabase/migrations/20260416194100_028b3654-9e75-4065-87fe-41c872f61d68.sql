
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'active';

-- Allow only service_role / super_admin to change payment_status (reuse the existing protect trigger pattern)
CREATE OR REPLACE FUNCTION public.protect_org_billing_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role' OR public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.plan IS DISTINCT FROM OLD.plan
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at
     OR NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    RAISE EXCEPTION 'Only super admins or service role can modify billing fields';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS protect_org_billing_fields_trigger ON public.organizations;
CREATE TRIGGER protect_org_billing_fields_trigger
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_org_billing_fields();

-- Effective access function: returns whether user currently has paid access
CREATE OR REPLACE FUNCTION public.get_effective_plan(_user_id uuid)
RETURNS TABLE(plan text, has_access boolean, payment_status text, period_end timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  org_id uuid;
  org_plan text;
  org_payment_status text;
  org_trial_ends timestamptz;
  sub_status text;
  sub_period_end timestamptz;
  sub_cancel_at_end boolean;
BEGIN
  SELECT organization_id INTO org_id
  FROM public.organization_members
  WHERE user_id = _user_id
  LIMIT 1;

  IF org_id IS NULL THEN
    RETURN QUERY SELECT 'free'::text, false, 'none'::text, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT o.plan, o.payment_status, o.trial_ends_at
  INTO org_plan, org_payment_status, org_trial_ends
  FROM public.organizations o
  WHERE o.id = org_id;

  SELECT s.status, s.current_period_end, s.cancel_at_period_end
  INTO sub_status, sub_period_end, sub_cancel_at_end
  FROM public.subscriptions s
  WHERE s.user_id = _user_id
  ORDER BY s.updated_at DESC
  LIMIT 1;

  -- Trial still valid for free plan
  IF org_plan = 'free' AND org_trial_ends > now() THEN
    RETURN QUERY SELECT org_plan, true, org_payment_status, org_trial_ends;
    RETURN;
  END IF;

  -- Paid plan: check subscription
  IF org_plan != 'free' THEN
    -- Active or trialing
    IF sub_status IN ('active', 'trialing') THEN
      RETURN QUERY SELECT org_plan, true, org_payment_status, sub_period_end;
      RETURN;
    END IF;
    -- Canceled but still in grace period
    IF sub_status = 'canceled' AND sub_period_end IS NOT NULL AND sub_period_end > now() THEN
      RETURN QUERY SELECT org_plan, true, 'canceled_grace'::text, sub_period_end;
      RETURN;
    END IF;
    -- Past due — still grant access (grace), banner shown in UI
    IF sub_status = 'past_due' THEN
      RETURN QUERY SELECT org_plan, true, 'past_due'::text, sub_period_end;
      RETURN;
    END IF;
  END IF;

  -- No active access
  RETURN QUERY SELECT org_plan, false, COALESCE(org_payment_status, 'none'), sub_period_end;
END;
$$;
