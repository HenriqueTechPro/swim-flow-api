-- Swim Flow / Etapa 02C: manual PostgreSQL constraints.
-- This file is an INPUT for the first versioned Neon baseline migration.
-- DO NOT execute against a deployed database or the legacy Supabase schema.
-- Prisma 6 does not represent partial unique indexes or CHECK constraints.

ALTER TABLE "seasons"
  ADD CONSTRAINT "seasons_year_range_chk"
  CHECK ("year" BETWEEN 2000 AND 2100),
  ADD CONSTRAINT "seasons_date_order_chk"
  CHECK ("starts_on" <= "ends_on");

-- At most one ACTIVE season. Other planned/closed seasons are unrestricted.
CREATE UNIQUE INDEX "seasons_one_active_idx"
  ON "seasons" ("status") WHERE "status" = 'ACTIVE';

ALTER TABLE "student_classes"
  ADD CONSTRAINT "student_classes_date_order_chk"
  CHECK ("to_date" IS NULL OR "from_date" <= "to_date");

-- A student may join more than one class only when records are non-primary.
-- A primary registration is unique among CURRENT (to_date IS NULL) links.
CREATE UNIQUE INDEX "student_classes_one_active_primary_idx"
  ON "student_classes" ("student_id")
  WHERE "to_date" IS NULL AND "is_primary" = TRUE;

-- No two concurrently active links between the same student and class.
-- Historical re-enrolments in the SAME class remain possible.
CREATE UNIQUE INDEX "student_classes_one_active_pair_idx"
  ON "student_classes" ("student_id", "class_id")
  WHERE "to_date" IS NULL;

-- Multiple assistant coaches are allowed, only one head coach per class.
CREATE UNIQUE INDEX "class_teachers_one_head_coach_idx"
  ON "class_teachers" ("class_id")
  WHERE "role" = 'head_coach';

-- Age bands may intentionally remain NULL when the category has no bound.
ALTER TABLE "categories"
  ADD CONSTRAINT "categories_age_range_chk"
  CHECK (
    ("age_min" IS NULL OR "age_min" >= 0)
    AND ("age_max" IS NULL OR "age_max" >= 0)
    AND ("age_min" IS NULL OR "age_max" IS NULL OR "age_min" <= "age_max")
  );
