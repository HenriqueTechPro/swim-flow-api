-- Verify that the additive 02E-16B.3 migration is present in the disposable CI DB.
DO $$
DECLARE
  actual integer;
BEGIN
  IF to_regclass('public.media_objects') IS NULL THEN
    RAISE EXCEPTION 'media_objects table missing';
  END IF;
  SELECT count(*) INTO actual
  FROM pg_constraint
  WHERE conrelid = 'public.media_objects'::regclass
    AND conname IN (
      'media_objects_private_key_chk',
      'media_objects_mime_chk',
      'media_objects_declared_size_chk',
      'media_objects_confirmation_chk',
      'media_objects_requested_by_id_fkey'
    );
  IF actual <> 5 THEN
    RAISE EXCEPTION 'private media constraints incomplete: %', actual;
  END IF;
  SELECT count(*) INTO actual
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'media_objects'
    AND indexname IN (
      'media_objects_object_key_key',
      'media_objects_target_resource_id_status_idx',
      'media_objects_requested_by_id_created_at_idx',
      'media_objects_status_created_at_idx'
    );
  IF actual <> 4 THEN
    RAISE EXCEPTION 'private media indexes incomplete: %', actual;
  END IF;
END $$;
