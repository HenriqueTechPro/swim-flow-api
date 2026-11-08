-- Restore all official age/category reference rows in staging and new installs.
-- The Postgres enum already contains these values; only catalog rows were incomplete.
-- Existing category IDs, teacher/student/class links, and metadata are untouched.
-- Safe to re-run: the unique category name constraint prevents duplicates.
INSERT INTO "categories" ("id", "name", "age_min", "age_max", "sort_order")
SELECT
  gen_random_uuid(),
  defaults.name::"swimming_category",
  defaults.age_min,
  defaults.age_max,
  defaults.sort_order
FROM (
  VALUES
  ('Pré-Mirim', 0, 8, 1),
  ('Mirim 1', 9, 9, 2),
  ('Mirim 2', 10, 10, 3),
  ('Petiz 1', 11, 11, 4),
  ('Petiz 2', 12, 12, 5),
  ('Infantil 1', 13, 13, 6),
  ('Infantil 2', 14, 14, 7),
  ('Juvenil 1', 15, 15, 8),
  ('Juvenil 2', 16, 16, 9),
  ('Júnior 1', 17, 17, 10),
  ('Júnior 2', 18, 19, 11),
  ('Sênior', 20, 24, 12),
  ('Pré-Master', 20, 24, 13),
  ('Master A', 25, 29, 14),
  ('Master B', 30, 34, 15),
  ('Master C', 35, 39, 16),
  ('Master D', 40, 44, 17),
  ('Master E', 45, 49, 18),
  ('Master F', 50, 54, 19),
  ('Master G', 55, 59, 20),
  ('Master H', 60, 64, 21),
  ('Master I', 65, 69, 22),
  ('Master J', 70, 74, 23),
  ('Master K', 75, 79, 24),
  ('Master L', 80, 84, 25),
  ('Master M', 85, 89, 26),
  ('Master N', 90, 94, 27),
  ('Master O', 95, 99, 28)
) AS defaults(name, age_min, age_max, sort_order)
ON CONFLICT ("name") DO NOTHING;
