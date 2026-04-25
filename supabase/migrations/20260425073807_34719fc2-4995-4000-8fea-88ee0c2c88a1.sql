-- Support conversations (one per session/user thread)
CREATE TABLE public.support_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  organization_id uuid,
  visitor_id text, -- for anonymous visitors on public site
  subject text,
  status text NOT NULL DEFAULT 'open', -- open | resolved | escalated
  source text NOT NULL DEFAULT 'app', -- app | public
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_conv_user ON public.support_conversations(user_id);
CREATE INDEX idx_support_conv_visitor ON public.support_conversations(visitor_id);
CREATE INDEX idx_support_conv_status ON public.support_conversations(status);

ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;

-- Users can view their own conversations
CREATE POLICY "Users view own support conversations"
  ON public.support_conversations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own conversations
CREATE POLICY "Users insert own support conversations"
  ON public.support_conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update own (e.g. close)
CREATE POLICY "Users update own support conversations"
  ON public.support_conversations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Anonymous visitors: allow service role only (handled via edge function)
CREATE POLICY "Service role manages support conversations"
  ON public.support_conversations FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Super admin can view all
CREATE POLICY "Super admin views all support conversations"
  ON public.support_conversations FOR SELECT TO public
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admin updates all support conversations"
  ON public.support_conversations FOR UPDATE TO public
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admin deletes support conversations"
  ON public.support_conversations FOR DELETE TO public
  USING (is_super_admin(auth.uid()));

-- Support messages
CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  role text NOT NULL, -- user | assistant | system | admin
  content text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_msg_conv ON public.support_messages(conversation_id, created_at);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own support messages"
  ON public.support_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.support_conversations c
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Service role manages support messages"
  ON public.support_messages FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Super admin views all support messages"
  ON public.support_messages FOR SELECT TO public
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admin inserts support messages"
  ON public.support_messages FOR INSERT TO public
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admin deletes support messages"
  ON public.support_messages FOR DELETE TO public
  USING (is_super_admin(auth.uid()));

-- Support tickets (escalated to email)
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.support_conversations(id) ON DELETE SET NULL,
  user_id uuid,
  visitor_id text,
  name text,
  email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new', -- new | in_progress | resolved
  email_sent boolean NOT NULL DEFAULT false,
  email_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_user ON public.support_tickets(user_id);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own support tickets"
  ON public.support_tickets FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages support tickets"
  ON public.support_tickets FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Super admin views all tickets"
  ON public.support_tickets FOR SELECT TO public
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admin updates tickets"
  ON public.support_tickets FOR UPDATE TO public
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admin deletes tickets"
  ON public.support_tickets FOR DELETE TO public
  USING (is_super_admin(auth.uid()));

-- Updated_at triggers
CREATE TRIGGER update_support_conv_updated_at
  BEFORE UPDATE ON public.support_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime for admin live view
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;