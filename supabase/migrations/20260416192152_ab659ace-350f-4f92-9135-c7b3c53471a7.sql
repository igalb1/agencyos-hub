
-- 1. Fix privilege escalation: restrict org updates to owners only, block plan/billing fields
DROP POLICY IF EXISTS "Org owners can update their organization" ON public.organizations;

CREATE POLICY "Org owners can update their organization"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = organizations.id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = organizations.id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  );

-- Trigger to prevent non-superadmin/non-service from editing billing-sensitive columns
CREATE OR REPLACE FUNCTION public.protect_org_billing_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.plan IS DISTINCT FROM OLD.plan
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at THEN
    RAISE EXCEPTION 'Only super admins or service role can modify plan, is_active, or trial_ends_at';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_org_billing_fields_trigger ON public.organizations;
CREATE TRIGGER protect_org_billing_fields_trigger
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.protect_org_billing_fields();

-- 2. Restrict subscription SELECT policy to authenticated role
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
CREATE POLICY "Users can view own subscription"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. Tighten self-join policy: only allow on orgs created within last 60 seconds
DROP POLICY IF EXISTS "Org creators can self-join empty org" ON public.organization_members;
CREATE POLICY "Org creators can self-join new org"
  ON public.organization_members FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = organization_members.organization_id
    )
    AND EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_members.organization_id
        AND o.created_at > now() - interval '60 seconds'
    )
  );
