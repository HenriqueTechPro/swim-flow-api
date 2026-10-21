-- Executed ONLY on disposable CI PostgreSQL after versioned Prisma migrations.
-- Introspection only: no user records are read, seeded or mutated.
DO $$
DECLARE
  table_count INTEGER;
  fk_count INTEGER;
  check_count INTEGER;
  unique_count INTEGER;
BEGIN
  SELECT count(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    AND table_name IN ('local_auth_identities','local_auth_action_tokens');
  IF table_count <> 2 THEN
    RAISE EXCEPTION 'Expected both local authentication tables, got %', table_count;
  END IF;

  SELECT count(*) INTO fk_count FROM pg_constraint
  WHERE contype='f'
    AND conname IN ('local_auth_identities_user_id_fkey',
                    'local_auth_action_tokens_user_id_fkey');
  IF fk_count <> 2 THEN
    RAISE EXCEPTION 'Missing local identity foreign keys';
  END IF;

  SELECT count(*) INTO check_count FROM pg_constraint
  WHERE contype='c' AND convalidated
    AND conname IN (
      'local_auth_identity_normalized_email_chk',
      'local_auth_token_digest_chk',
      'local_auth_token_purpose_chk',
      'local_auth_token_expiry_chk',
      'local_auth_token_consumption_chk');
  IF check_count <> 5 THEN
    RAISE EXCEPTION 'Expected five validated local authentication CHECK constraints';
  END IF;

  SELECT count(*) INTO unique_count
  FROM pg_indexes
  WHERE schemaname='public'
    AND indexname IN ('local_auth_identities_email_key',
                      'local_auth_action_tokens_token_hash_key');
  IF unique_count <> 2 THEN
    RAISE EXCEPTION 'Missing unique credentials/token indices';
  END IF;

  IF (SELECT count(*) FROM local_auth_identities) <> 0 OR
     (SELECT count(*) FROM local_auth_action_tokens) <> 0 THEN
    RAISE EXCEPTION 'Local auth migration must not seed or import identities';
  END IF;
END $$;
