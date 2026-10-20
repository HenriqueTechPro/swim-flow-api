-- Include in the FIRST versioned Neon migration, AFTER Prisma's model SQL.
-- Not applied to any database by this PR. PostgreSQL accepts many false values,
-- but only one primary guardian per student.
CREATE UNIQUE INDEX "student_guardians_one_primary_idx"
  ON "student_guardians" ("student_id")
  WHERE "is_primary" = TRUE;

-- More than one teacher cannot claim the same auth account because
-- Teacher.profileId has a Prisma @unique, enforced by a database UNIQUE index.
-- Link accounts only via authenticated ADMIN workflows with verified identity.
-- Never infer a teacher's account by display name or matching email.
