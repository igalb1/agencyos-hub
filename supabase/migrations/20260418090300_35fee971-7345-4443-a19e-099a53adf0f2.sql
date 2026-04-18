-- Add 'delete_user' action to admin_manage_user (handles only DB cleanup; auth user deleted via edge function)
CREATE OR REPLACE FUNCTION public.admin_delete_user_data(_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only super admin can delete users');
  END IF;

  IF _target_user_id = auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot delete yourself');
  END IF;

  -- Block deletion if user is sole owner of any org (force ownership transfer first)
  IF EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.user_id = _target_user_id AND m.role = 'owner'
      AND (
        SELECT COUNT(*) FROM public.organization_members m2
        WHERE m2.organization_id = m.organization_id AND m2.role = 'owner'
      ) = 1
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User is sole owner of an organization. Transfer ownership first.');
  END IF;

  -- Delete dependent data
  DELETE FROM public.user_integrations WHERE user_id = _target_user_id;
  DELETE FROM public.subscriptions WHERE user_id = _target_user_id;
  DELETE FROM public.user_roles WHERE user_id = _target_user_id;
  DELETE FROM public.organization_members WHERE user_id = _target_user_id;
  DELETE FROM public.profiles WHERE user_id = _target_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;