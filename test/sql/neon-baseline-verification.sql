-- Executed ONLY against the disposable CI PostgreSQL service,
-- after prisma migrate deploy. A failure aborts the workflow.
DO $$
DECLARE
  -- Frozen baseline has 31 domain tables, native Auth adds two,
  -- and private-media metadata adds one; _prisma_migrations excluded.
  expected_tables integer := 34;
  found_tables integer;
  missing_indexes text;
  missing_checks text;
BEGIN
  SELECT count(*) INTO found_tables FROM information_schema.tables
   WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     AND table_name <> '_prisma_migrations';
  IF found_tables <> expected_tables THEN
    RAISE EXCEPTION 'Expected % domain tables, found %', expected_tables, found_tables;
  END IF;

  SELECT string_agg(name, ', ') INTO missing_indexes
  FROM unnest(ARRAY[
    'seasons_one_active_idx',
    'student_classes_one_active_primary_idx',
    'student_classes_one_active_pair_idx',
    'class_teachers_one_head_coach_idx',
    'student_guardians_one_primary_idx',
    'ex_students_one_current_departure_idx'
  ]) AS name WHERE to_regclass('public.' || quote_ident(name)) IS NULL;
  IF missing_indexes IS NOT NULL THEN
    RAISE EXCEPTION 'Missing unique partial indexes: %', missing_indexes;
  END IF;

  SELECT string_agg(name, ', ') INTO missing_checks
  FROM unnest(ARRAY[
    'seasons_year_range_chk', 'seasons_date_order_chk',
    'student_classes_date_order_chk', 'categories_age_range_chk',
    'ex_students_single_closure_chk', 'ex_students_nonnegative_achievements_chk',
    'pool_results_distance_positive_chk', 'pool_results_classified_duration_chk',
    'open_water_results_distance_positive_chk', 'open_water_results_classified_duration_chk',
    'pools_length_positive_chk', 'technical_criteria_score_bounds_chk',
    'technical_scores_nonnegative_chk', 'anthropometry_positive_measures_chk'
  ]) AS name WHERE NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = name AND contype = 'c' AND convalidated
  );
  IF missing_checks IS NOT NULL THEN
    RAISE EXCEPTION 'Missing CHECK constraints: %', missing_checks;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pool_results' AND column_name = 'duration_ms' AND is_nullable = 'YES'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'open_water_results' AND column_name = 'duration_ms' AND is_nullable = 'YES'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'anthropometric_assessments' AND column_name = 'arm_span_cm'
      AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'Required nullable fields missing or unexpectedly NOT NULL';
  END IF;
END $$;

-- Verify behavior, not only presence of a constraint or index.
INSERT INTO "seasons" ("id", "year", "label", "starts_on", "ends_on", "status")
VALUES ('aa000000-0000-4000-8000-000000000001', 2090, 'CI Active', '2090-01-01', '2090-12-31', 'ACTIVE');

DO $$
BEGIN
  BEGIN
    INSERT INTO "seasons" ("id", "year", "label", "starts_on", "ends_on", "status")
    VALUES ('aa000000-0000-4000-8000-000000000002', 2091, 'Second Active', '2091-01-01', '2091-12-31', 'ACTIVE');
    RAISE EXCEPTION 'Second ACTIVE season unexpectedly accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL; -- Expected: seasons_one_active_idx
  END;

  BEGIN
    INSERT INTO "seasons" ("id", "year", "label", "starts_on", "ends_on", "status")
    VALUES ('aa000000-0000-4000-8000-000000000003', 2092, 'Invalid dates', '2092-12-31', '2092-01-01', 'PLANNED');
    RAISE EXCEPTION 'Inverted season dates unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END $$;

INSERT INTO "pools" ("id", "name", "length_meters")
VALUES ('bb000000-0000-4000-8000-000000000001', 'CI 20-meter pool', 20);

DO $$
BEGIN
  BEGIN
    INSERT INTO "pools" ("id", "name", "length_meters")
    VALUES ('bb000000-0000-4000-8000-000000000002', 'Invalid pool', 0);
    RAISE EXCEPTION 'Zero-length pool unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END $$;
