
-- Tighten realtime topic match: must START with the uid or contain ':uid' / '-uid' boundary
DROP POLICY IF EXISTS "Authenticated can subscribe to own user topics" ON realtime.messages;
CREATE POLICY "Authenticated can subscribe to own user topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    realtime.topic() LIKE auth.uid()::text || '%'
    OR realtime.topic() LIKE '%-' || auth.uid()::text
    OR realtime.topic() LIKE '%-' || auth.uid()::text || '-%'
    OR realtime.topic() LIKE '%:' || auth.uid()::text || '%'
    OR realtime.topic() LIKE '%=' || auth.uid()::text || '%'
  )
);

-- Restrictive deny policies for email tables (defense in depth)
DROP POLICY IF EXISTS "Restrict email_send_log to service role" ON public.email_send_log;
CREATE POLICY "Restrict email_send_log to service role"
ON public.email_send_log AS RESTRICTIVE
FOR ALL
TO authenticated, anon
USING ( auth.role() = 'service_role' )
WITH CHECK ( auth.role() = 'service_role' );

DROP POLICY IF EXISTS "Restrict suppressed_emails to service role" ON public.suppressed_emails;
CREATE POLICY "Restrict suppressed_emails to service role"
ON public.suppressed_emails AS RESTRICTIVE
FOR ALL
TO authenticated, anon
USING ( auth.role() = 'service_role' )
WITH CHECK ( auth.role() = 'service_role' );

DROP POLICY IF EXISTS "Restrict unsubscribe_tokens to service role" ON public.email_unsubscribe_tokens;
CREATE POLICY "Restrict unsubscribe_tokens to service role"
ON public.email_unsubscribe_tokens AS RESTRICTIVE
FOR ALL
TO authenticated, anon
USING ( auth.role() = 'service_role' )
WITH CHECK ( auth.role() = 'service_role' );
