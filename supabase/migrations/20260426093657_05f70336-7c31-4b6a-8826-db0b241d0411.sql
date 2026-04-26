
DROP POLICY IF EXISTS "Authenticated can subscribe to own user topics" ON realtime.messages;
CREATE POLICY "Authenticated can subscribe to own user topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND realtime.topic() LIKE auth.uid()::text || ':%'
);
