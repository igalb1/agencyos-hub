
-- Update encryption helpers to accept the key as a parameter from the edge function
-- (avoiding the need for Supabase Vault, which is no longer exposed in Lovable Cloud UI).

CREATE OR REPLACE FUNCTION public.set_integration_tokens(
  _user_id uuid,
  _provider text,
  _access_token text,
  _refresh_token text,
  _account_id text,
  _account_name text,
  _token_expires_at timestamp with time zone,
  _encryption_key text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  k text;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Only service role can set integration tokens';
  END IF;

  k := _encryption_key;
  IF k IS NULL OR length(k) = 0 THEN
    -- Fallback: try Vault if available
    BEGIN
      SELECT decrypted_secret INTO k
      FROM vault.decrypted_secrets
      WHERE name = 'integrations_encryption_key'
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      k := NULL;
    END;
  END IF;

  IF k IS NULL OR length(k) = 0 THEN
    RAISE EXCEPTION 'Encryption key not provided and not found in Vault';
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.get_integration_tokens(
  _user_id uuid,
  _provider text,
  _encryption_key text DEFAULT NULL
)
RETURNS TABLE(access_token text, refresh_token text, token_expires_at timestamp with time zone, account_id text, account_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  k text;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Only service role can read integration tokens';
  END IF;

  k := _encryption_key;
  IF k IS NULL OR length(k) = 0 THEN
    BEGIN
      SELECT decrypted_secret INTO k
      FROM vault.decrypted_secrets
      WHERE name = 'integrations_encryption_key'
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      k := NULL;
    END;
  END IF;

  IF k IS NULL OR length(k) = 0 THEN
    RAISE EXCEPTION 'Encryption key not provided and not found in Vault';
  END IF;

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
$function$;
