-- Swim Flow 02E-16B.3: additive metadata ONLY for future private S3/R2 objects.
-- No existing Supabase URLs or images are imported, moved or deleted.
-- This SQL is versioned, but must NOT be deployed on Neon staging in this PR.
-- The stored object key is never a public URL or a short-lived signed token.
CREATE TABLE "private_media_objects" (
    "id" UUID NOT NULL,
    "object_key" VARCHAR(255) NOT NULL,
    "target" VARCHAR(32) NOT NULL,
    "resource_id" UUID NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "uploaded_by_profile_id" UUID,
    "declared_content_type" VARCHAR(32) NOT NULL,
    "declared_size_bytes" INTEGER NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    "ticket_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "private_media_objects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "private_media_objects_object_key_key"
    ON "private_media_objects"("object_key");

CREATE INDEX "private_media_objects_target_resource_id_status_idx"
    ON "private_media_objects"("target", "resource_id", "status");

CREATE INDEX "private_media_objects_uploaded_by_id_status_idx"
    ON "private_media_objects"("uploaded_by_id", "status");

CREATE INDEX "private_media_objects_status_ticket_expires_at_idx"
    ON "private_media_objects"("status", "ticket_expires_at");

ALTER TABLE "private_media_objects"
    ADD CONSTRAINT "private_media_objects_uploaded_by_profile_id_fkey"
    FOREIGN KEY ("uploaded_by_profile_id") REFERENCES "profiles"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "private_media_objects"
    ADD CONSTRAINT "private_media_target_chk"
    CHECK ("target" IN ('profile-avatar', 'student-photo', 'teacher-photo', 'parent-photo'));

ALTER TABLE "private_media_objects"
    ADD CONSTRAINT "private_media_status_chk"
    CHECK ("status" IN ('PENDING', 'VERIFIED', 'REJECTED', 'DELETED'));

ALTER TABLE "private_media_objects"
    ADD CONSTRAINT "private_media_mime_chk"
    CHECK ("declared_content_type" IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif'));

ALTER TABLE "private_media_objects"
    ADD CONSTRAINT "private_media_size_chk"
    CHECK ("declared_size_bytes" BETWEEN 1 AND 5242880);

ALTER TABLE "private_media_objects"
    ADD CONSTRAINT "private_media_lifecycle_chk"
    CHECK (
        "ticket_expires_at" > "created_at"
        AND ("verified_at" IS NULL OR "status" = 'VERIFIED')
        AND ("status" <> 'VERIFIED' OR "verified_at" IS NOT NULL)
    );

ALTER TABLE "private_media_objects"
    ADD CONSTRAINT "private_media_uploader_snapshot_chk"
    CHECK ("uploaded_by_profile_id" IS NULL OR "uploaded_by_profile_id" = "uploaded_by_id");

-- Require a known namespace, UUID-like scope, random identifier and image
-- extension. The object key is still opaque and must never grant access.
ALTER TABLE "private_media_objects"
    ADD CONSTRAINT "private_media_private_key_chk"
    CHECK (
        "object_key" ~ '^private/(profiles|students|teachers|parents)/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|gif|webp)$'
        AND (
            ("target" = 'profile-avatar' AND "object_key" LIKE 'private/profiles/%')
            OR ("target" = 'student-photo' AND "object_key" LIKE 'private/students/%')
            OR ("target" = 'teacher-photo' AND "object_key" LIKE 'private/teachers/%')
            OR ("target" = 'parent-photo' AND "object_key" LIKE 'private/parents/%')
        )
    );
