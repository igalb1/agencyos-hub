
CREATE TABLE public.user_google_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  google_email TEXT NOT NULL,
  google_sub TEXT,
  access_token_encrypted BYTEA,
  refresh_token_encrypted BYTEA,
  token_expires_at TIMESTAMPTZ,
  scope TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_google_connections ENABLE ROW LEVEL SECURITY;

-- Users can see whether they're connected and which email — but NOT the tokens
CREATE POLICY "Users view own google connection"
ON public.user_google_connections FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own google connection"
ON public.user_google_connections FOR DELETE
USING (auth.uid() = user_id);

-- Inserts/updates are done by service role from edge functions only
CREATE POLICY "Service role manages google connections"
ON public.user_google_connections FOR ALL
TO service_role
USING (true) WITH CHECK (true);

CREATE TRIGGER update_user_google_connections_updated_at
BEFORE UPDATE ON public.user_google_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper functions to encrypt/decrypt tokens (service role only)
CREATE OR REPLACE FUNCTION public.set_google_user_tokens(
  _user_id UUID,
  _google_email TEXT,
  _google_sub TEXT,
  _access_token TEXT,
  _refresh_token TEXT,
  _expires_at TIMESTAMPTZ,
  _scope TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE k TEXT;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Only service role can set google tokens';
  END IF;
  k := public.get_integrations_encryption_key();

  INSERT INTO public.user_google_connections (
    user_id, google_email, google_sub,
    access_token_encrypted, refresh_token_encrypted,
    token_expires_at, scope
  ) VALUES (
    _user_id, _google_email, _google_sub,
    extensions.pgp_sym_encrypt(_access_token, k),
    CASE WHEN _refresh_token IS NOT NULL THEN extensions.pgp_sym_encrypt(_refresh_token, k) ELSE NULL END,
    _expires_at, _scope
  )
  ON CONFLICT (user_id) DO UPDATE SET
    google_email = EXCLUDED.google_email,
    google_sub = EXCLUDED.google_sub,
    access_token_encrypted = EXCLUDED.access_token_encrypted,
    refresh_token_encrypted = COALESCE(EXCLUDED.refresh_token_encrypted, public.user_google_connections.refresh_token_encrypted),
    token_expires_at = EXCLUDED.token_expires_at,
    scope = EXCLUDED.scope,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_google_user_tokens(_user_id UUID)
RETURNS TABLE(access_token TEXT, refresh_token TEXT, token_expires_at TIMESTAMPTZ, google_email TEXT, scope TEXT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE k TEXT;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Only service role can read google tokens';
  END IF;
  k := public.get_integrations_encryption_key();

  RETURN QUERY
  SELECT
    extensions.pgp_sym_decrypt(c.access_token_encrypted, k),
    CASE WHEN c.refresh_token_encrypted IS NOT NULL THEN extensions.pgp_sym_decrypt(c.refresh_token_encrypted, k) ELSE NULL END,
    c.token_expires_at, c.google_email, c.scope
  FROM public.user_google_connections c
  WHERE c.user_id = _user_id;
END;
$$;
