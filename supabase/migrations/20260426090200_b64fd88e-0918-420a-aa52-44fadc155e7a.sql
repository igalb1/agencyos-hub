
-- 1. Schema additions
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS domain text,
  ADD COLUMN IF NOT EXISTS owner_user_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_domain_unique
  ON public.organizations (lower(domain)) WHERE domain IS NOT NULL;

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Validation trigger for status (instead of CHECK)
CREATE OR REPLACE FUNCTION public.validate_member_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('pending','active','suspended','removed') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_member_status_trg ON public.organization_members;
CREATE TRIGGER validate_member_status_trg
  BEFORE INSERT OR UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.validate_member_status();

-- 2. Backfill
UPDATE public.organization_members SET status = 'active' WHERE status IS NULL OR status = '';

UPDATE public.organizations o
SET owner_user_id = (
  SELECT m.user_id FROM public.organization_members m
  WHERE m.organization_id = o.id AND m.role = 'owner'
  ORDER BY m.created_at ASC LIMIT 1
)
WHERE owner_user_id IS NULL;

-- 3. Public-domain helper
CREATE OR REPLACE FUNCTION public.is_public_email_domain(_domain text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
  SELECT lower(_domain) IN (
    'gmail.com','googlemail.com','outlook.com','hotmail.com','live.com','msn.com',
    'yahoo.com','yahoo.co.uk','yahoo.co.il','ymail.com','rocketmail.com',
    'icloud.com','me.com','mac.com','aol.com','aim.com',
    'proton.me','protonmail.com','pm.me',
    'gmx.com','gmx.de','gmx.net','mail.com','zoho.com','yandex.com','yandex.ru',
    'walla.com','walla.co.il','nana10.co.il','012.net.il','bezeqint.net'
  );
$$;

-- 4. Update is_org_member / is_org_admin to require active
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id AND status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id
      AND role IN ('owner','admin') AND status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_org_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT organization_id FROM public.organization_members
  WHERE user_id = _user_id AND status = 'active'
$$;

-- 5. Rewrite handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  email_domain text;
  invite_token_value text;
  invite_record record;
  matching_org_id uuid;
  new_org_id uuid;
  desired_org_name text;
BEGIN
  -- Always create profile
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT DO NOTHING;

  email_domain := lower(split_part(NEW.email, '@', 2));
  invite_token_value := NEW.raw_user_meta_data->>'invite_token';

  -- 1) Invite path takes precedence
  IF invite_token_value IS NOT NULL THEN
    SELECT * INTO invite_record FROM public.organization_invitations
    WHERE token = invite_token_value
      AND accepted_at IS NULL
      AND expires_at > now()
      AND lower(email) = lower(NEW.email)
    LIMIT 1;

    IF invite_record.id IS NOT NULL THEN
      INSERT INTO public.organization_members (organization_id, user_id, role, status)
      VALUES (invite_record.organization_id, NEW.id, invite_record.role, 'active')
      ON CONFLICT DO NOTHING;
      UPDATE public.organization_invitations
      SET accepted_at = now(), accepted_by = NEW.id WHERE id = invite_record.id;
      RETURN NEW;
    END IF;
  END IF;

  -- 2) Business-domain auto-detect (only if not public domain)
  IF NOT public.is_public_email_domain(email_domain) THEN
    SELECT id INTO matching_org_id FROM public.organizations
    WHERE lower(domain) = email_domain LIMIT 1;

    IF matching_org_id IS NOT NULL THEN
      -- Existing org with this domain → join as PENDING member
      INSERT INTO public.organization_members (organization_id, user_id, role, status)
      VALUES (matching_org_id, NEW.id, 'member', 'pending')
      ON CONFLICT DO NOTHING;
      RETURN NEW;
    END IF;
  END IF;

  -- 3) Create new org if user provided org_name (signup form)
  desired_org_name := NEW.raw_user_meta_data->>'org_name';
  IF desired_org_name IS NOT NULL AND length(trim(desired_org_name)) > 0 THEN
    INSERT INTO public.organizations (name, domain, owner_user_id)
    VALUES (
      trim(desired_org_name),
      CASE WHEN public.is_public_email_domain(email_domain) THEN NULL ELSE email_domain END,
      NEW.id
    )
    RETURNING id INTO new_org_id;

    INSERT INTO public.organization_members (organization_id, user_id, role, status)
    VALUES (new_org_id, NEW.id, 'owner', 'active');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Approve / Reject RPCs
CREATE OR REPLACE FUNCTION public.approve_member(_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE m record;
BEGIN
  SELECT * INTO m FROM public.organization_members WHERE id = _member_id;
  IF m.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Member not found'); END IF;
  IF NOT public.is_org_admin(auth.uid(), m.organization_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  UPDATE public.organization_members SET status = 'active' WHERE id = _member_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_member(_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE m record;
BEGIN
  SELECT * INTO m FROM public.organization_members WHERE id = _member_id;
  IF m.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Member not found'); END IF;
  IF NOT public.is_org_admin(auth.uid(), m.organization_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  IF m.role = 'owner' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot reject the owner');
  END IF;
  DELETE FROM public.organization_members WHERE id = _member_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_pending_members(_org_id uuid)
RETURNS TABLE(member_id uuid, user_id uuid, email text, full_name text, role text, requested_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.id, m.user_id, u.email::text, p.full_name, m.role, m.created_at
  FROM public.organization_members m
  JOIN auth.users u ON u.id = m.user_id
  LEFT JOIN public.profiles p ON p.user_id = m.user_id
  WHERE m.organization_id = _org_id
    AND m.status = 'pending'
    AND public.is_org_admin(auth.uid(), _org_id)
  ORDER BY m.created_at ASC;
$$;

-- 7. Membership-status helper for the signed-in user
CREATE OR REPLACE FUNCTION public.get_my_memberships()
RETURNS TABLE(organization_id uuid, organization_name text, role text, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.organization_id, o.name, m.role, m.status
  FROM public.organization_members m
  JOIN public.organizations o ON o.id = m.organization_id
  WHERE m.user_id = auth.uid();
$$;

-- 8. Extend get_org_members_with_details with status
DROP FUNCTION IF EXISTS public.get_org_members_with_details(uuid);
CREATE OR REPLACE FUNCTION public.get_org_members_with_details(_org_id uuid)
RETURNS TABLE(member_id uuid, user_id uuid, email text, full_name text, avatar_url text, role text, status text, joined_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.id, m.user_id, u.email::text, p.full_name, p.avatar_url, m.role, m.status, m.created_at
  FROM public.organization_members m
  JOIN auth.users u ON u.id = m.user_id
  LEFT JOIN public.profiles p ON p.user_id = m.user_id
  WHERE m.organization_id = _org_id
    AND public.is_org_member(auth.uid(), _org_id)
  ORDER BY
    CASE m.status WHEN 'pending' THEN 0 ELSE 1 END,
    m.created_at ASC;
$$;

-- 9. transfer_org_ownership keeps organizations.owner_user_id in sync
CREATE OR REPLACE FUNCTION public.transfer_org_ownership(_org_id uuid, _new_owner_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE is_member boolean;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only super admin can transfer ownership');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id AND user_id = _new_owner_user_id AND status = 'active'
  ) INTO is_member;

  IF NOT is_member THEN
    RETURN jsonb_build_object('success', false, 'error', 'User is not an active member of this organization');
  END IF;

  UPDATE public.organization_members SET role = 'admin'
  WHERE organization_id = _org_id AND role = 'owner';

  UPDATE public.organization_members SET role = 'owner'
  WHERE organization_id = _org_id AND user_id = _new_owner_user_id;

  UPDATE public.organizations SET owner_user_id = _new_owner_user_id WHERE id = _org_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 10. Block owner self-removal at the data layer too
CREATE OR REPLACE FUNCTION public.protect_owner_membership()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.is_super_admin(auth.uid()) THEN
    RETURN OLD;
  END IF;
  IF OLD.role = 'owner' THEN
    RAISE EXCEPTION 'Cannot remove an owner. Transfer ownership first.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS protect_owner_membership_trg ON public.organization_members;
CREATE TRIGGER protect_owner_membership_trg
  BEFORE DELETE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.protect_owner_membership();
