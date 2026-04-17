-- Keep role as text (avoid breaking existing policies). Add 'admin' as valid value via app convention.

-- 1. Helper: is admin (owner or admin)
CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id AND role IN ('owner','admin')
  )
$$;

-- 2. Invitations table
CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invitations_org ON public.organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.organization_invitations(lower(email));
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.organization_invitations(token);

ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members view invitations" ON public.organization_invitations;
DROP POLICY IF EXISTS "Org admins create invitations" ON public.organization_invitations;
DROP POLICY IF EXISTS "Org admins delete invitations" ON public.organization_invitations;
DROP POLICY IF EXISTS "Service role manages invitations" ON public.organization_invitations;

CREATE POLICY "Org members view invitations" ON public.organization_invitations FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org admins create invitations" ON public.organization_invitations FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id) AND invited_by = auth.uid());
CREATE POLICY "Org admins delete invitations" ON public.organization_invitations FOR DELETE TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id));
CREATE POLICY "Service role manages invitations" ON public.organization_invitations FOR ALL TO public
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 3. Atomic signup trigger: profile + (invite-join OR new-org-as-owner)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_org_id uuid;
  org_name_value text;
  invite_token_value text;
  invite_record record;
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT DO NOTHING;

  invite_token_value := NEW.raw_user_meta_data->>'invite_token';

  IF invite_token_value IS NOT NULL THEN
    SELECT * INTO invite_record FROM public.organization_invitations
    WHERE token = invite_token_value AND accepted_at IS NULL AND expires_at > now()
      AND lower(email) = lower(NEW.email)
    LIMIT 1;

    IF invite_record.id IS NOT NULL THEN
      INSERT INTO public.organization_members (organization_id, user_id, role)
      VALUES (invite_record.organization_id, NEW.id, invite_record.role)
      ON CONFLICT DO NOTHING;
      UPDATE public.organization_invitations
      SET accepted_at = now(), accepted_by = NEW.id WHERE id = invite_record.id;
      RETURN NEW;
    END IF;
  END IF;

  org_name_value := NEW.raw_user_meta_data->>'org_name';
  IF org_name_value IS NOT NULL AND length(trim(org_name_value)) > 0 THEN
    INSERT INTO public.organizations (name) VALUES (org_name_value) RETURNING id INTO new_org_id;
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (new_org_id, NEW.id, 'owner');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Invitation lookup + accept RPCs
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(_token text)
RETURNS TABLE(id uuid, organization_id uuid, organization_name text, email text, role text, expires_at timestamptz, accepted_at timestamptz, invited_by_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id, i.organization_id, o.name, i.email, i.role, i.expires_at, i.accepted_at, p.full_name
  FROM public.organization_invitations i
  JOIN public.organizations o ON o.id = i.organization_id
  LEFT JOIN public.profiles p ON p.user_id = i.invited_by
  WHERE i.token = _token LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.accept_invitation(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv record; user_email text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
  SELECT * INTO inv FROM public.organization_invitations
  WHERE token = _token AND accepted_at IS NULL AND expires_at > now() LIMIT 1;
  IF inv.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Invitation not found or expired'); END IF;
  IF lower(inv.email) <> lower(user_email) THEN RETURN jsonb_build_object('success', false, 'error', 'Invitation is for a different email address'); END IF;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (inv.organization_id, auth.uid(), inv.role) ON CONFLICT DO NOTHING;
  UPDATE public.organization_invitations SET accepted_at = now(), accepted_by = auth.uid() WHERE id = inv.id;
  RETURN jsonb_build_object('success', true, 'organization_id', inv.organization_id);
END;
$$;

-- 5. Tighten clients/campaigns/projects: only admins delete
DROP POLICY IF EXISTS "org members manage clients" ON public.clients;
CREATE POLICY "Org members read clients" ON public.clients FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members update clients" ON public.clients FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org admins delete clients" ON public.clients FOR DELETE TO authenticated USING (public.is_org_admin(auth.uid(), organization_id));

DROP POLICY IF EXISTS "org members manage campaigns" ON public.campaigns;
CREATE POLICY "Org members read campaigns" ON public.campaigns FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members insert campaigns" ON public.campaigns FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members update campaigns" ON public.campaigns FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org admins delete campaigns" ON public.campaigns FOR DELETE TO authenticated USING (public.is_org_admin(auth.uid(), organization_id));

DROP POLICY IF EXISTS "org members manage projects" ON public.projects;
CREATE POLICY "Org members read projects" ON public.projects FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members insert projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members update projects" ON public.projects FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org admins delete projects" ON public.projects FOR DELETE TO authenticated USING (public.is_org_admin(auth.uid(), organization_id));

-- 6. Allow admins to delete/update members (in addition to existing owner-only)
DROP POLICY IF EXISTS "Org admins remove members" ON public.organization_members;
DROP POLICY IF EXISTS "Org admins update members" ON public.organization_members;
CREATE POLICY "Org admins remove members" ON public.organization_members FOR DELETE TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id) AND role <> 'owner');
CREATE POLICY "Org admins update members" ON public.organization_members FOR UPDATE TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id) AND role <> 'owner');

-- 7. Team listing RPC (with email + names)
CREATE OR REPLACE FUNCTION public.get_org_members_with_details(_org_id uuid)
RETURNS TABLE(member_id uuid, user_id uuid, email text, full_name text, avatar_url text, role text, joined_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.user_id, u.email, p.full_name, p.avatar_url, m.role, m.created_at
  FROM public.organization_members m
  JOIN auth.users u ON u.id = m.user_id
  LEFT JOIN public.profiles p ON p.user_id = m.user_id
  WHERE m.organization_id = _org_id AND public.is_org_member(auth.uid(), _org_id)
  ORDER BY m.created_at ASC;
$$;