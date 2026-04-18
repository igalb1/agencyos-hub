
CREATE OR REPLACE FUNCTION public.transfer_org_ownership(_org_id uuid, _new_owner_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_member boolean;
BEGIN
  -- Only super_admin can transfer ownership
  IF NOT public.is_super_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only super admin can transfer ownership');
  END IF;

  -- Verify target user is a member of the org
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id AND user_id = _new_owner_user_id
  ) INTO is_member;

  IF NOT is_member THEN
    RETURN jsonb_build_object('success', false, 'error', 'User is not a member of this organization');
  END IF;

  -- Demote current owner(s) to admin
  UPDATE public.organization_members
  SET role = 'admin'
  WHERE organization_id = _org_id AND role = 'owner';

  -- Promote new user to owner
  UPDATE public.organization_members
  SET role = 'owner'
  WHERE organization_id = _org_id AND user_id = _new_owner_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
