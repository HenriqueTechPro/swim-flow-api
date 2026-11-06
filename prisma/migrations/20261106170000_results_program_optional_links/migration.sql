-- Additive only: old results remain unlinked and unchanged. No backfill.
ALTER TABLE "pool_results" ADD COLUMN "pool_program_race_id" UUID;
CREATE INDEX "pool_results_pool_program_race_id_idx" ON "pool_results"("pool_program_race_id");
ALTER TABLE "pool_results" ADD CONSTRAINT "pool_results_pool_program_race_id_fkey" FOREIGN KEY ("pool_program_race_id") REFERENCES "pool_program_races"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pool_results" ADD COLUMN "pool_program_heat_id" UUID;
CREATE INDEX "pool_results_pool_program_heat_id_idx" ON "pool_results"("pool_program_heat_id");
ALTER TABLE "pool_results" ADD CONSTRAINT "pool_results_pool_program_heat_id_fkey" FOREIGN KEY ("pool_program_heat_id") REFERENCES "pool_program_heats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "open_water_results" ADD COLUMN "open_water_program_race_id" UUID;
CREATE INDEX "open_water_results_open_water_program_race_id_idx" ON "open_water_results"("open_water_program_race_id");
ALTER TABLE "open_water_results" ADD CONSTRAINT "open_water_results_open_water_program_race_id_fkey" FOREIGN KEY ("open_water_program_race_id") REFERENCES "open_water_program_races"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "open_water_results" ADD COLUMN "open_water_program_start_id" UUID;
CREATE INDEX "open_water_results_open_water_program_start_id_idx" ON "open_water_results"("open_water_program_start_id");
ALTER TABLE "open_water_results" ADD CONSTRAINT "open_water_results_open_water_program_start_id_fkey" FOREIGN KEY ("open_water_program_start_id") REFERENCES "open_water_program_starts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
