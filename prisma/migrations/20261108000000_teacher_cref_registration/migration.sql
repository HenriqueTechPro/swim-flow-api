-- Nullable additive field; old records remain untouched.
-- Deploy this before serving the API code that reads the new column.
ALTER TABLE "teachers" ADD COLUMN "cref" VARCHAR(20);
