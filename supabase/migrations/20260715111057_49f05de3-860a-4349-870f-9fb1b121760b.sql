
-- Revoke public EXECUTE on internal SECURITY DEFINER helpers.
-- These are only meant to be invoked by triggers, cron, or service_role edge functions.

DO $$
DECLARE
  fn text;
  internal_fns text[] := ARRAY[
    'get_cron_service_role_key()',
    'get_integrations_encryption_key()',
    'get_google_user_tokens(uuid)',
    'set_google_user_tokens(uuid, text, text, text, text, timestamptz, text)',
    'get_integration_tokens(uuid, text)',
    'set_integration_tokens(uuid, text, text, text, text, text, timestamptz)',
    'seed_cron_service_role_key(text)',
    'trigger_facebook_ads_auto_sync()',
    'trigger_linkedin_ads_auto_sync()',
    'trigger_google_ads_auto_sync()',
    'trigger_client_sheet_auto_sync()',
    'email_queue_dispatch()',
    'email_queue_wake()',
    'enqueue_email(text, jsonb)',
    'read_email_batch(text, integer, integer)',
    'delete_email(text, bigint)',
    'move_to_dlq(text, text, bigint, jsonb)',
    'handle_new_user()',
    'protect_org_billing_fields()',
    'protect_owner_membership()',
    'validate_member_status()',
    'update_updated_at_column()'
  ];
BEGIN
  FOREACH fn IN ARRAY internal_fns LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', fn);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'Function public.% not found, skipping', fn;
    END;
  END LOOP;
END $$;
