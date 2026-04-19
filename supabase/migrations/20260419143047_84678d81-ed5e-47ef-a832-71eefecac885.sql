DO $$
DECLARE
  k text;
BEGIN
  -- Read from project secret env (available to Postgres via app settings? fallback: generate)
  -- Since we cannot read OS env from SQL, we insert a generated key if not present.
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'integrations_encryption_key') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'integrations_encryption_key',
      'Encryption key for user_integrations tokens'
    );
  END IF;
END $$;