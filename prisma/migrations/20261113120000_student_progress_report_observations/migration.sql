-- This migration must only be applied AFTER reconciling the pending category
-- catalog migration ledger. Never apply it directly to staging without review.
CREATE TABLE "student_progress_report_observations" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "season_id" UUID NOT NULL,
    "observation" VARCHAR(2000) NOT NULL,
    "responsible_teacher_id" UUID,
    "responsible_teacher_name" VARCHAR(160),
    "responsible_teacher_cref" VARCHAR(20),
    "created_by_profile_id" UUID,
    "created_by_name" VARCHAR(160) NOT NULL,
    "updated_by_profile_id" UUID,
    "updated_by_name" VARCHAR(160) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "student_progress_report_observations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_progress_report_observations_student_id_season_id_key"
    ON "student_progress_report_observations"("student_id", "season_id");

CREATE INDEX "student_progress_report_observations_season_id_idx"
    ON "student_progress_report_observations"("season_id");

CREATE INDEX "student_progress_report_observations_responsible_teacher_id_idx"
    ON "student_progress_report_observations"("responsible_teacher_id");

ALTER TABLE "student_progress_report_observations"
    ADD CONSTRAINT "student_progress_report_observations_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_progress_report_observations"
    ADD CONSTRAINT "student_progress_report_observations_season_id_fkey"
    FOREIGN KEY ("season_id") REFERENCES "seasons"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_progress_report_observations"
    ADD CONSTRAINT "student_progress_report_observations_created_by_profile_id_fkey"
    FOREIGN KEY ("created_by_profile_id") REFERENCES "profiles"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "student_progress_report_observations"
    ADD CONSTRAINT "student_progress_report_observations_updated_by_profile_id_fkey"
    FOREIGN KEY ("updated_by_profile_id") REFERENCES "profiles"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
