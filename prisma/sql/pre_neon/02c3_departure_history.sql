-- Append to the initial Prisma-generated Neon baseline, after the tables exist.
-- This SQL has NOT been executed against any database.
-- Guarantees at most one currently active departure per student while
-- permitting multiple historical departures after a genuine return.
CREATE UNIQUE INDEX "ex_students_one_current_departure_idx"
  ON "ex_students" ("student_id")
  WHERE "reactivated_at" IS NULL AND "voided_at" IS NULL;

ALTER TABLE "ex_students"
  ADD CONSTRAINT "ex_students_single_closure_chk"
    CHECK ("reactivated_at" IS NULL OR "voided_at" IS NULL),
  ADD CONSTRAINT "ex_students_exit_date_chk"
    CHECK ("exit_date_at" <= CURRENT_DATE),
  ADD CONSTRAINT "ex_students_nonnegative_achievements_chk"
    CHECK ("achievements" >= 0);
