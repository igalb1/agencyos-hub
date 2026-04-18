
-- Add frozen status to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_frozen boolean NOT NULL DEFAULT false;

-- Super admin user management function
CREATE OR REPLACE FUNCTION public.admin_manage_user(
  _target_user_id uuid,
  _action text, -- 'freeze', 'unfreeze', 'remove_from_org'
  _org_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only super_admin
  IF NOT public.is_super_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only super admin can manage users');
  END IF;

  IF _action = 'freeze' THEN
    UPDATE public.profiles SET is_frozen = true WHERE user_id = _target_user_id;
    RETURN jsonb_build_object('success', true);

  ELSIF _action = 'unfreeze' THEN
    UPDATE public.profiles SET is_frozen = false WHERE user_id = _target_user_id;
    RETURN jsonb_build_object('success', true);

  ELSIF _action = 'remove_from_org' THEN
    IF _org_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'org_id required for remove_from_org');
    END IF;
    -- Don't allow removing an owner
    IF EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = _target_user_id AND organization_id = _org_id AND role = 'owner'
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cannot remove owner. Transfer ownership first.');
    END IF;
    DELETE FROM public.organization_members
    WHERE user_id = _target_user_id AND organization_id = _org_id;
    RETURN jsonb_build_object('success', true);

  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid action');
  END IF;
END;
$$;

-- Function to get all users with their org memberships for admin panel
CREATE OR REPLACE FUNCTION public.admin_get_users()
RETURNS TABLE(
  user_id uuid,
  full_name text,
  email text,
  is_frozen boolean,
  created_at timestamptz,
  organizations jsonb
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admin';
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    p.full_name,
    u.email::text,
    p.is_frozen,
    p.created_at,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'org_id', o.id,
        'org_name', o.name,
        'role', m.role
      ))
      FROM public.organization_members m
      JOIN public.organizations o ON o.id = m.organization_id
      WHERE m.user_id = p.user_id),
      '[]'::jsonb
    ) as organizations
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  ORDER BY p.created_at DESC;
END;
$$;
