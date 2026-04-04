-- Align the trainings table with the open-water capable domain model.
-- This keeps the schema compatible with the current app contract while
-- preserving existing rows through a safe backfill.

ALTER TABLE public.trainings
  ADD COLUMN IF NOT EXISTS venue_type text,
  ADD COLUMN IF NOT EXISTS location_name text;

UPDATE public.trainings
SET venue_type = CASE
  WHEN pool_id IS NULL THEN 'Outro'
  ELSE 'Piscina'
END
WHERE venue_type IS NULL;

UPDATE public.trainings
SET location_name = CASE
  WHEN venue_type = 'Piscina' THEN ''
  ELSE COALESCE(NULLIF(BTRIM(location_name), ''), 'Local não informado')
END
WHERE location_name IS NULL
   OR (venue_type <> 'Piscina' AND LENGTH(BTRIM(location_name)) = 0);

ALTER TABLE public.trainings
  ALTER COLUMN venue_type SET DEFAULT 'Piscina',
  ALTER COLUMN venue_type SET NOT NULL,
  ALTER COLUMN location_name SET DEFAULT '',
  ALTER COLUMN location_name SET NOT NULL,
  ALTER COLUMN level SET DEFAULT 'Todos'::nivel_treino,
  ALTER COLUMN max_participants SET DEFAULT 10;

DO $$
BEGIN
  ALTER TABLE public.trainings
    ADD CONSTRAINT trainings_venue_type_check
    CHECK (venue_type = ANY (ARRAY['Piscina', 'Mar', 'Rio', 'Lago', 'Represa', 'Outro']));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.trainings
    ADD CONSTRAINT trainings_venue_location_consistency_check
    CHECK (
      (venue_type = 'Piscina' AND pool_id IS NOT NULL)
      OR (venue_type <> 'Piscina' AND LENGTH(BTRIM(location_name)) > 0)
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
