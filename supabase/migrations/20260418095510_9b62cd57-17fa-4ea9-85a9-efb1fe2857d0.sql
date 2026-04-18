
-- Block authenticated users from inserting into user_roles (defense-in-depth against privilege escalation)
CREATE POLICY "Deny authenticated self-insert into user_roles"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Restrict invitation tokens visibility: only the inviter sees the token row directly
DROP POLICY IF EXISTS "Org admins view invitations" ON public.organization_invitations;
CREATE POLICY "Inviter views own invitations"
ON public.organization_invitations
FOR SELECT
TO authenticated
USING (invited_by = auth.uid() AND public.is_org_admin(auth.uid(), organization_id));

-- Provide a token-free view of pending invitations for org admins (so they can still see who was invited)
CREATE OR REPLACE VIEW public.organization_invitations_safe
WITH (security_invoker = true) AS
SELECT id, organization_id, email, role, invited_by, created_at, expires_at, accepted_at, accepted_by
FROM public.organization_invitations;

GRANT SELECT ON public.organization_invitations_safe TO authenticated;

-- Fix mutable search_path on email queue functions
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
