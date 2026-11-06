-- Additive preparation ONLY: no writes, updates, deletes, backfills or
-- inferred associations in existing pool_results/open_water_results.
-- Do not apply directly to Neon; validate via disposable PostgreSQL CI.
CREATE TYPE "race_gender_scope" AS ENUM ('MASCULINO', 'FEMININO', 'MISTO');

CREATE TABLE "pool_program_races" (
  "id" UUID NOT NULL,
  "event_id" UUID NOT NULL,
  "session_code" VARCHAR(40) NOT NULL,
  "race_number" INTEGER NOT NULL,
  "style" "swimming_style" NOT NULL,
  "distance_meters" INTEGER NOT NULL,
  "pool_length_meters" DECIMAL(6,2) NOT NULL,
  "format" "pool_result_format" NOT NULL DEFAULT 'INDIVIDUAL',
  "category_snapshot" VARCHAR(120) NOT NULL,
  "gender_scope" "race_gender_scope" NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pool_program_races_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pool_program_race_positive_chk" CHECK (
    "race_number" > 0 AND "distance_meters" > 0 AND "pool_length_meters" > 0
  ),
  CONSTRAINT "pool_program_race_scope_nonblank_chk" CHECK (
    length(btrim("session_code")) > 0 AND length(btrim("category_snapshot")) > 0
  )
);

CREATE TABLE "pool_program_heats" (
  "id" UUID NOT NULL,
  "race_id" UUID NOT NULL,
  "heat_number" INTEGER NOT NULL,
  "planned_start_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pool_program_heats_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pool_program_heat_positive_chk" CHECK ("heat_number" > 0)
);

CREATE TABLE "open_water_program_races" (
  "id" UUID NOT NULL,
  "event_id" UUID NOT NULL,
  "session_code" VARCHAR(40) NOT NULL,
  "race_number" INTEGER NOT NULL,
  "distance_meters" INTEGER NOT NULL,
  "body_type" "open_water_body_type" NOT NULL,
  "route_key" VARCHAR(160) NOT NULL,
  "format" "open_water_result_format" NOT NULL DEFAULT 'TRAVESSIA',
  "category_snapshot" VARCHAR(120) NOT NULL,
  "gender_scope" "race_gender_scope" NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "open_water_program_races_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "open_water_program_race_positive_chk" CHECK (
    "race_number" > 0 AND "distance_meters" > 0
  ),
  CONSTRAINT "open_water_program_race_scope_nonblank_chk" CHECK (
    length(btrim("session_code")) > 0 AND
    length(btrim("route_key")) > 0 AND
    length(btrim("category_snapshot")) > 0
  )
);

CREATE TABLE "open_water_program_starts" (
  "id" UUID NOT NULL,
  "race_id" UUID NOT NULL,
  "wave_number" INTEGER NOT NULL,
  "planned_start_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "open_water_program_starts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "open_water_program_start_positive_chk" CHECK ("wave_number" > 0)
);

CREATE UNIQUE INDEX "pool_program_race_event_session_number_uq"
  ON "pool_program_races"("event_id", "session_code", "race_number");
CREATE INDEX "pool_program_race_scope_idx"
  ON "pool_program_races"("event_id", "gender_scope", "category_snapshot");
CREATE UNIQUE INDEX "pool_program_heat_race_number_uq"
  ON "pool_program_heats"("race_id", "heat_number");
CREATE INDEX "pool_program_heat_start_idx"
  ON "pool_program_heats"("planned_start_at");

CREATE UNIQUE INDEX "open_water_program_race_event_session_number_uq"
  ON "open_water_program_races"("event_id", "session_code", "race_number");
CREATE INDEX "open_water_program_race_route_idx"
  ON "open_water_program_races"("event_id", "route_key", "distance_meters");
CREATE UNIQUE INDEX "open_water_program_start_race_wave_uq"
  ON "open_water_program_starts"("race_id", "wave_number");
CREATE INDEX "open_water_program_start_at_idx"
  ON "open_water_program_starts"("planned_start_at");

ALTER TABLE "pool_program_races"
  ADD CONSTRAINT "pool_program_races_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pool_program_heats"
  ADD CONSTRAINT "pool_program_heats_race_id_fkey"
  FOREIGN KEY ("race_id") REFERENCES "pool_program_races"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "open_water_program_races"
  ADD CONSTRAINT "open_water_program_races_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "open_water_program_starts"
  ADD CONSTRAINT "open_water_program_starts_race_id_fkey"
  FOREIGN KEY ("race_id") REFERENCES "open_water_program_races"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Future PR: distinct result-to-race/heat vs result-to-start links,
-- audited homologation and internal notifications. No results linked here.
