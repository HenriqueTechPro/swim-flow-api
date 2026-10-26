-- Swim Flow 02E-17D: explicit storage provider & private active photo binding.
-- New additive migration only: previous SQL and real Neon data left untouched.
-- Historical S3/R2 rows default to R2; only new server Blob rows use BLOB.
ALTER TABLE "private_media_objects"
  ADD COLUMN "storage_provider" VARCHAR(16) NOT NULL DEFAULT 'R2';

ALTER TABLE "private_media_objects"
  ALTER COLUMN "ticket_expires_at" DROP NOT NULL;

ALTER TABLE "private_media_objects"
  ADD CONSTRAINT "private_media_provider_chk"
    CHECK ("storage_provider" IN ('R2', 'BLOB'));

-- The original constraint requires a real signed upload expiry for R2,
-- while server-mediated Blob has no ticket and starts already VERIFIED.
ALTER TABLE "private_media_objects"
  DROP CONSTRAINT "private_media_lifecycle_chk";

ALTER TABLE "private_media_objects"
  ADD CONSTRAINT "private_media_lifecycle_chk"
    CHECK (
      (
        "storage_provider" = 'R2'
        AND "ticket_expires_at" IS NOT NULL
        AND "ticket_expires_at" > "created_at"
        AND ("verified_at" IS NULL OR "status" = 'VERIFIED')
        AND ("status" <> 'VERIFIED' OR "verified_at" IS NOT NULL)
      )
      OR (
        "storage_provider" = 'BLOB'
        AND "ticket_expires_at" IS NULL
        AND "status" = 'VERIFIED'
        AND "verified_at" IS NOT NULL
      )
    );

-- Composite FK requires an exact resource, provider and VERIFIED state.
-- PostgreSQL then prevents linking a pending R2 object, a foreign child
-- photo or any blob whose state has been downgraded.
CREATE UNIQUE INDEX "private_media_objects_id_target_resource_id_storage_provide_key"
  ON "private_media_objects"("id", "target", "resource_id", "storage_provider", "status");

CREATE TABLE "private_media_active_bindings" (
  "target" VARCHAR(32) NOT NULL,
  "resource_id" UUID NOT NULL,
  "media_id" UUID NOT NULL,
  "storage_provider" VARCHAR(16) NOT NULL DEFAULT 'BLOB',
  "status" VARCHAR(16) NOT NULL DEFAULT 'VERIFIED',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "private_media_active_bindings_pkey"
    PRIMARY KEY ("target", "resource_id"),
  CONSTRAINT "private_media_active_binding_provider_chk"
    CHECK ("storage_provider" = 'BLOB' AND "status" = 'VERIFIED')
);

CREATE UNIQUE INDEX "private_media_active_bindings_media_id_key"
  ON "private_media_active_bindings"("media_id");

ALTER TABLE "private_media_active_bindings"
  ADD CONSTRAINT "private_media_active_bindings_media_id_target_resource_id__fkey"
  FOREIGN KEY ("media_id", "target", "resource_id", "storage_provider", "status")
  REFERENCES "private_media_objects"("id", "target", "resource_id", "storage_provider", "status")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
