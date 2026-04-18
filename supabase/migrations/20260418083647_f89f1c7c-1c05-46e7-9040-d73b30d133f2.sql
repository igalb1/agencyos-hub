
-- 1) Unique index on organization name (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS organizations_name_unique ON public.organizations (lower(name));

-- 2) Replace handle_new_user to auto-join existing org as member
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_org_id uuid;
  existing_org_id uuid;
  org_name_value text;
  invite_token_value text;
  invite_record record;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT DO NOTHING;

  -- Check for invite token first
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

  -- No valid invite — use org_name
  org_name_value := NEW.raw_user_meta_data->>'org_name';
  IF org_name_value IS NOT NULL AND length(trim(org_name_value)) > 0 THEN
    -- Check if org already exists (case-insensitive)
    SELECT id INTO existing_org_id
    FROM public.organizations
    WHERE lower(name) = lower(trim(org_name_value))
    LIMIT 1;

    IF existing_org_id IS NOT NULL THEN
      -- Org exists: join as member
      INSERT INTO public.organization_members (organization_id, user_id, role)
      VALUES (existing_org_id, NEW.id, 'member')
      ON CONFLICT DO NOTHING;
    ELSE
      -- Org doesn't exist: create new, user becomes temporary owner
      INSERT INTO public.organizations (name) VALUES (trim(org_name_value)) RETURNING id INTO new_org_id;
      INSERT INTO public.organization_members (organization_id, user_id, role)
      VALUES (new_org_id, NEW.id, 'owner');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
