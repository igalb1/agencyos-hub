
-- 1. Lock down user_roles INSERT/UPDATE/DELETE: only service_role can mutate
DROP POLICY IF EXISTS "Service role manages roles" ON public.user_roles;

CREATE POLICY "Service role can insert roles"
  ON public.user_roles FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update roles"
  ON public.user_roles FOR UPDATE
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can delete roles"
  ON public.user_roles FOR DELETE
  TO public
  USING (auth.role() = 'service_role');

-- 2. Add WITH CHECK to super admin subscription UPDATE policy
DROP POLICY IF EXISTS "Super admin can manage all subscriptions" ON public.subscriptions;
CREATE POLICY "Super admin can manage all subscriptions"
  ON public.subscriptions FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 3. Encrypt OAuth tokens using pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Add encrypted token columns
ALTER TABLE public.user_integrations
  ADD COLUMN IF NOT EXISTS access_token_encrypted bytea,
  ADD COLUMN IF NOT EXISTS refresh_token_encrypted bytea;

-- Helper to fetch encryption key from vault/settings
-- Uses a database setting set via ALTER DATABASE or pg_settings; falls back gracefully
CREATE OR REPLACE FUNCTION public.get_integrations_encryption_key()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  k text;
BEGIN
  -- Try Supabase Vault first
  BEGIN
    SELECT decrypted_secret INTO k
    FROM vault.decrypted_secrets
    WHERE name = 'integrations_encryption_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    k := NULL;
  END;

  IF k IS NULL OR length(k) = 0 THEN
    RAISE EXCEPTION 'integrations_encryption_key not configured in Supabase Vault';
  END IF;
  RETURN k;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_integrations_encryption_key() FROM PUBLIC, anon, authenticated;

-- Service-role-only function to write encrypted tokens
CREATE OR REPLACE FUNCTION public.set_integration_tokens(
  _user_id uuid,
  _provider text,
  _access_token text,
  _refresh_token text,
  _account_id text,
  _account_name text,
  _token_expires_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  k text;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Only service role can set integration tokens';
  END IF;

  k := public.get_integrations_encryption_key();

  INSERT INTO public.user_integrations (
    user_id, provider,
    access_token_encrypted, refresh_token_encrypted,
    account_id, account_name, token_expires_at, is_connected
  ) VALUES (
    _user_id, _provider,
    CASE WHEN _access_token IS NOT NULL THEN extensions.pgp_sym_encrypt(_access_token, k) ELSE NULL END,
    CASE WHEN _refresh_token IS NOT NULL THEN extensions.pgp_sym_encrypt(_refresh_token, k) ELSE NULL END,
    _account_id, _account_name, _token_expires_at, true
  )
  ON CONFLICT (user_id, provider) DO UPDATE SET
    access_token_encrypted = EXCLUDED.access_token_encrypted,
    refresh_token_encrypted = COALESCE(EXCLUDED.refresh_token_encrypted, public.user_integrations.refresh_token_encrypted),
    account_id = EXCLUDED.account_id,
    account_name = EXCLUDED.account_name,
    token_expires_at = EXCLUDED.token_expires_at,
    is_connected = true,
    updated_at = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_integration_tokens(uuid, text, text, text, text, text, timestamptz) FROM PUBLIC, anon, authenticated;

-- Service-role-only function to read decrypted tokens
CREATE OR REPLACE FUNCTION public.get_integration_tokens(_user_id uuid, _provider text)
RETURNS TABLE (access_token text, refresh_token text, token_expires_at timestamptz, account_id text, account_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  k text;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Only service role can read integration tokens';
  END IF;

  k := public.get_integrations_encryption_key();

  RETURN QUERY
  SELECT
    CASE WHEN ui.access_token_encrypted IS NOT NULL THEN extensions.pgp_sym_decrypt(ui.access_token_encrypted, k) ELSE NULL END,
    CASE WHEN ui.refresh_token_encrypted IS NOT NULL THEN extensions.pgp_sym_decrypt(ui.refresh_token_encrypted, k) ELSE NULL END,
    ui.token_expires_at,
    ui.account_id,
    ui.account_name
  FROM public.user_integrations ui
  WHERE ui.user_id = _user_id AND ui.provider = _provider;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_integration_tokens(uuid, text) FROM PUBLIC, anon, authenticated;

-- Add unique constraint required for ON CONFLICT (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_integrations_user_provider_unique'
  ) THEN
    ALTER TABLE public.user_integrations
      ADD CONSTRAINT user_integrations_user_provider_unique UNIQUE (user_id, provider);
  END IF;
END $$;

-- Drop the SELECT policy that exposes raw plaintext token columns to authenticated users.
-- Users will still be able to see connection metadata via a safe view below.
DROP POLICY IF EXISTS "Users can view own integrations" ON public.user_integrations;

-- Create a metadata-only view for clients (no token columns)
CREATE OR REPLACE VIEW public.user_integrations_safe
WITH (security_invoker = true)
AS
SELECT
  id, user_id, provider, account_id, account_name,
  is_connected, token_expires_at, created_at, updated_at
FROM public.user_integrations;

GRANT SELECT ON public.user_integrations_safe TO authenticated;

-- Migrate any existing plaintext tokens to encrypted columns (best-effort; skipped if key missing)
DO $$
DECLARE
  k text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO k FROM vault.decrypted_secrets WHERE name = 'integrations_encryption_key' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    k := NULL;
  END;

  IF k IS NOT NULL AND length(k) > 0 THEN
    UPDATE public.user_integrations
    SET access_token_encrypted = CASE WHEN access_token IS NOT NULL THEN extensions.pgp_sym_encrypt(access_token, k) ELSE access_token_encrypted END,
        refresh_token_encrypted = CASE WHEN refresh_token IS NOT NULL THEN extensions.pgp_sym_encrypt(refresh_token, k) ELSE refresh_token_encrypted END
    WHERE access_token IS NOT NULL OR refresh_token IS NOT NULL;

    -- Null out plaintext columns after migration
    UPDATE public.user_integrations SET access_token = NULL, refresh_token = NULL;
  END IF;
END $$;
