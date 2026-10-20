-- Additional immutable PostgreSQL domain checks on a FRESH schema.
-- Run after the Prisma-generated CREATE TABLE / CREATE TYPE statements.

ALTER TABLE "pool_results"
  ADD CONSTRAINT "pool_results_distance_positive_chk" CHECK ("distance_meters" > 0),
  ADD CONSTRAINT "pool_results_pool_length_positive_chk" CHECK ("pool_length_meters" IS NULL OR "pool_length_meters" > 0),
  ADD CONSTRAINT "pool_results_duration_positive_chk" CHECK ("duration_ms" IS NULL OR "duration_ms" > 0),
  ADD CONSTRAINT "pool_results_position_positive_chk" CHECK ("position" IS NULL OR "position" > 0),
  ADD CONSTRAINT "pool_results_classified_duration_chk" CHECK ("status" <> 'CLASSIFIED' OR "duration_ms" IS NOT NULL);

ALTER TABLE "open_water_results"
  ADD CONSTRAINT "open_water_results_distance_positive_chk" CHECK ("distance_meters" > 0),
  ADD CONSTRAINT "open_water_results_duration_positive_chk" CHECK ("duration_ms" IS NULL OR "duration_ms" > 0),
  ADD CONSTRAINT "open_water_results_position_positive_chk" CHECK ("position" IS NULL OR "position" > 0),
  ADD CONSTRAINT "open_water_results_classified_duration_chk" CHECK ("status" <> 'CLASSIFIED' OR "duration_ms" IS NOT NULL);

ALTER TABLE "pools"
  ADD CONSTRAINT "pools_length_positive_chk" CHECK ("length_meters" > 0),
  ADD CONSTRAINT "pools_capacity_positive_chk" CHECK ("max_capacity" IS NULL OR "max_capacity" > 0);

ALTER TABLE "technical_assessment_criteria"
  ADD CONSTRAINT "technical_criteria_score_bounds_chk" CHECK ("min_score" >= 0 AND "max_score" >= "min_score");

ALTER TABLE "technical_assessment_scores"
  ADD CONSTRAINT "technical_scores_nonnegative_chk" CHECK ("score" IS NULL OR "score" >= 0);

ALTER TABLE "anthropometric_assessments"
  ADD CONSTRAINT "anthropometry_positive_measures_chk"
  CHECK (
    ("height_cm" IS NULL OR "height_cm" > 0) AND
    ("body_mass_kg" IS NULL OR "body_mass_kg" > 0) AND
    ("arm_span_cm" IS NULL OR "arm_span_cm" > 0) AND
    ("leg_length_cm" IS NULL OR "leg_length_cm" > 0) AND
    ("foot_length_cm" IS NULL OR "foot_length_cm" > 0) AND
    ("hand_length_cm" IS NULL OR "hand_length_cm" > 0) AND
    ("trunk_length_cm" IS NULL OR "trunk_length_cm" > 0)
  );
