
-- 1) Drop plaintext token columns; only encrypted versions remain
ALTER TABLE public.user_integrations DROP COLUMN IF EXISTS access_token;
ALTER TABLE public.user_integrations DROP COLUMN IF EXISTS refresh_token;

-- 2) Explicitly deny user-initiated subscription inserts (service role policy still applies)
CREATE POLICY "Block user subscription inserts"
ON public.subscriptions
FOR INSERT
TO authenticated
WITH CHECK (false);

-- 3) Restrict org owners from promoting members to owner role
DROP POLICY IF EXISTS "Org owners can update members" ON public.organization_members;
CREATE POLICY "Org owners can update members"
ON public.organization_members
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = organization_members.organization_id
      AND m.user_id = auth.uid()
      AND m.role = 'owner'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = organization_members.organization_id
      AND m.user_id = auth.uid()
      AND m.role = 'owner'
  )
  AND role <> 'owner'
);
