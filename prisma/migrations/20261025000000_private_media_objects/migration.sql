-- Swim Flow 02E-16B.3: additive, private media metadata on Neon/PostgreSQL.
-- This migration does NOT read, import or delete any existing Supabase photo.
-- Deploy separately before any private-media HTTP cutover.
CREATE TYPE "private_media_target" AS ENUM ('profile-avatar', 'student-photo', 'teacher-photo', 'parent-photo');
CREATE TYPE "private_media_status" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'DELETED');

CREATE TABLE "media_objects" (
    "id" UUID NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "target" "private_media_target" NOT NULL,
    "resource_id" UUID NOT NULL,
    "object_key" VARCHAR(255) NOT NULL,
    "status" "private_media_status" NOT NULL DEFAULT 'PENDING',
    "declared_content_type" VARCHAR(32) NOT NULL,
    "declared_size_bytes" INTEGER NOT NULL,
    "upload_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "confirmed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "media_objects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "media_objects_object_key_key" ON "media_objects"("object_key");
CREATE INDEX "media_objects_target_resource_id_status_idx" ON "media_objects"("target", "resource_id", "status");
CREATE INDEX "media_objects_requested_by_id_created_at_idx" ON "media_objects"("requested_by_id", "created_at");
CREATE INDEX "media_objects_status_created_at_idx" ON "media_objects"("status", "created_at");

ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_requested_by_id_fkey"
    FOREIGN KEY ("requested_by_id") REFERENCES "profiles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- No public URLs or arbitrary S3 keys are accepted as a durable reference.
ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_declared_size_chk"
    CHECK ("declared_size_bytes" BETWEEN 1 AND 5242880);
ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_mime_chk"
    CHECK ("declared_content_type" IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif'));
ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_private_key_chk"
    CHECK (
      "object_key" ~ '^private/(profiles|students|teachers|parents)/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(jpg|png|webp|gif)$'
      AND split_part("object_key", '/', 3) = "resource_id"::text
      AND split_part(split_part("object_key", '/', 4), '.', 1) = "id"::text
      AND split_part("object_key", '/', 2) =
        CASE "target"
          WHEN 'profile-avatar' THEN 'profiles'
          WHEN 'student-photo' THEN 'students'
          WHEN 'teacher-photo' THEN 'teachers'
          WHEN 'parent-photo' THEN 'parents'
        END
      AND split_part("object_key", '.', 2) =
        CASE "declared_content_type"
          WHEN 'image/jpeg' THEN 'jpg'
          WHEN 'image/png' THEN 'png'
          WHEN 'image/webp' THEN 'webp'
          WHEN 'image/gif' THEN 'gif'
        END
    );
ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_confirmation_chk"
    CHECK (
      ("status" <> 'CONFIRMED' OR "confirmed_at" IS NOT NULL)
      AND ("confirmed_at" IS NULL OR "status" IN ('CONFIRMED', 'DELETED'))
    );
