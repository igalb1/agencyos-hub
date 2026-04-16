-- 1. Restrict get_user_email to super_admins only
CREATE OR REPLACE FUNCTION public.get_user_email(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_super_admin(auth.uid())
    THEN (SELECT email FROM auth.users WHERE id = _user_id)
    ELSE NULL
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_email(uuid) FROM anon;

-- 2. Restrict organization_members INSERT: only allow self-join if user has no
-- existing membership in that org AND the org has no other members yet (org creator),
-- OR if performed by service_role. Existing members can be added only by service_role.
DROP POLICY IF EXISTS "Authenticated users can join orgs" ON public.organization_members;

CREATE POLICY "Org creators can self-join empty org"
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = organization_members.organization_id
  )
);

CREATE POLICY "Service role can insert members"
ON public.organization_members
FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role');

-- 3. Allow org owners to remove/update members within their organization
CREATE POLICY "Org owners can remove members"
ON public.organization_members
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = organization_members.organization_id
      AND m.user_id = auth.uid()
      AND m.role = 'owner'
  )
);

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
);

-- 4. Remove subscriptions table from realtime publication to prevent broadcast leaks
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'subscriptions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.subscriptions';
  END IF;
END $$;