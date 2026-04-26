
-- ============================================================
-- 1) Realtime channel authorization
-- ============================================================
-- Restrict realtime subscriptions to support topics so only the conversation owner
-- (or super_admin) can listen. Topic format used by client: any topic;
-- we also gate by checking that the subscriber is authenticated and
-- only allow specific support-* topics for owners.

-- Enable RLS on realtime.messages (Supabase manages the table)
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

-- Drop existing permissive policies if they exist
DROP POLICY IF EXISTS "Authenticated can subscribe to own support topics" ON realtime.messages;
DROP POLICY IF EXISTS "Super admin can subscribe to all support topics" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can subscribe to own user topics" ON realtime.messages;

-- Allow super admin to listen to anything
CREATE POLICY "Super admin can subscribe to all support topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING ( public.is_super_admin(auth.uid()) );

-- Allow regular authenticated users to subscribe ONLY to their own user-scoped topics
-- Convention: clients must use topics that include their auth.uid() (e.g. `org-sub-<uid>`)
-- This prevents cross-user snooping on support tables / etc.
CREATE POLICY "Authenticated can subscribe to own user topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND realtime.topic() LIKE '%' || auth.uid()::text || '%'
);

-- ============================================================
-- 2) Remove support tables from realtime publication
-- (admin support page already polls; safer than channel auth alone)
-- ============================================================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.support_conversations;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.support_messages;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.support_tickets;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ============================================================
-- 3) Explicit deny anonymous INSERT on support_tickets
-- ============================================================
DROP POLICY IF EXISTS "Deny anon insert support tickets" ON public.support_tickets;
CREATE POLICY "Deny anon insert support tickets"
ON public.support_tickets AS RESTRICTIVE
FOR INSERT
TO anon
WITH CHECK ( false );

-- Allow authenticated users to insert their own support tickets
DROP POLICY IF EXISTS "Authenticated users insert own tickets" ON public.support_tickets;
CREATE POLICY "Authenticated users insert own tickets"
ON public.support_tickets
FOR INSERT
TO authenticated
WITH CHECK ( auth.uid() = user_id );

-- ============================================================
-- 4) Block frozen users from accepting invites / approvals
-- ============================================================
CREATE OR REPLACE FUNCTION public.accept_invitation(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inv record;
  user_email text;
  is_frozen_flag boolean;
  existing_member record;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Frozen check
  SELECT is_frozen INTO is_frozen_flag FROM public.profiles WHERE user_id = auth.uid();
  IF COALESCE(is_frozen_flag, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is frozen');
  END IF;

  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO inv FROM public.organization_invitations
  WHERE token = _token AND accepted_at IS NULL AND expires_at > now() LIMIT 1;
  IF inv.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found or expired');
  END IF;

  IF lower(inv.email) <> lower(user_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation is for a different email address');
  END IF;

  -- If user already has a row (pending/active) — promote/upgrade
  SELECT * INTO existing_member FROM public.organization_members
  WHERE organization_id = inv.organization_id AND user_id = auth.uid()
  LIMIT 1;

  IF existing_member.id IS NOT NULL THEN
    -- Upgrade to active and apply invited role (only if it's not owner)
    UPDATE public.organization_members
    SET status = 'active',
        role = CASE WHEN existing_member.role = 'owner' THEN existing_member.role ELSE inv.role END
    WHERE id = existing_member.id;
  ELSE
    INSERT INTO public.organization_members (organization_id, user_id, role, status)
    VALUES (inv.organization_id, auth.uid(), inv.role, 'active');
  END IF;

  UPDATE public.organization_invitations SET accepted_at = now(), accepted_by = auth.uid() WHERE id = inv.id;
  RETURN jsonb_build_object('success', true, 'organization_id', inv.organization_id);
END;
$function$;

-- ============================================================
-- 5) Block frozen users from being approved
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_member(_member_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m record;
  is_frozen_flag boolean;
BEGIN
  SELECT * INTO m FROM public.organization_members WHERE id = _member_id;
  IF m.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Member not found'); END IF;
  IF NOT public.is_org_admin(auth.uid(), m.organization_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  -- Don't allow approving frozen users
  SELECT is_frozen INTO is_frozen_flag FROM public.profiles WHERE user_id = m.user_id;
  IF COALESCE(is_frozen_flag, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User account is frozen');
  END IF;
  UPDATE public.organization_members SET status = 'active' WHERE id = _member_id;
  RETURN jsonb_build_object('success', true);
END;
$function$;
