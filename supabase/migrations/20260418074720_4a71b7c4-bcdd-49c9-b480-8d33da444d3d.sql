-- 1) Add explicit SELECT policy on user_integrations restricted to owner
CREATE POLICY "Users can view own integrations"
ON public.user_integrations
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 2) Prevent org admins from updating their own membership row (no self-escalation)
DROP POLICY IF EXISTS "Org admins update members" ON public.organization_members;
CREATE POLICY "Org admins update members"
ON public.organization_members
FOR UPDATE
TO authenticated
USING (
  is_org_admin(auth.uid(), organization_id)
  AND user_id <> auth.uid()
  AND role <> 'owner'
)
WITH CHECK (
  is_org_admin(auth.uid(), organization_id)
  AND role <> 'owner'
  AND user_id <> auth.uid()
);

-- 3) Restrict invitation token visibility to org admins only (members no longer see tokens)
DROP POLICY IF EXISTS "Org members view invitations" ON public.organization_invitations;
CREATE POLICY "Org admins view invitations"
ON public.organization_invitations
FOR SELECT
TO authenticated
USING (is_org_admin(auth.uid(), organization_id));