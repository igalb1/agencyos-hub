-- Allow super admin to delete organizations
CREATE POLICY "Super admin can delete organizations"
ON public.organizations FOR DELETE
USING (public.is_super_admin(auth.uid()));

-- Allow super admin to delete org members (cascade cleanup)
CREATE POLICY "Super admin can delete org members"
ON public.organization_members FOR DELETE
USING (public.is_super_admin(auth.uid()));

-- Function to get user email from auth.users (security definer)
CREATE OR REPLACE FUNCTION public.get_user_email(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = _user_id
$$;
