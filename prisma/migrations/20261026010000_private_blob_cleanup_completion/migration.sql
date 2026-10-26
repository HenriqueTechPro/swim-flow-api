-- Swim Flow 02E-17G: additive, still INACTIVE Blob cleanup finalization.
-- Legacy R2 transitions and active-photo FK must remain unchanged.
ALTER TABLE "private_media_objects"
  ADD COLUMN "cleanup_completed_at" TIMESTAMPTZ(6);

ALTER TABLE "private_media_objects"
  DROP CONSTRAINT "private_media_lifecycle_chk";

ALTER TABLE "private_media_objects"
  ADD CONSTRAINT "private_media_lifecycle_chk"
  CHECK (
    (
      "storage_provider" = 'R2'
      AND "status" IN ('PENDING', 'VERIFIED', 'REJECTED', 'DELETED')
      AND "ticket_expires_at" IS NOT NULL
      AND "ticket_expires_at" > "created_at"
      AND ("verified_at" IS NULL OR "status" = 'VERIFIED')
      AND ("status" <> 'VERIFIED' OR "verified_at" IS NOT NULL)
      AND "cleanup_claimed_at" IS NULL
      AND "cleanup_completed_at" IS NULL
    )
    OR
    (
      "storage_provider" = 'BLOB'
      AND "ticket_expires_at" IS NULL
      AND "status" IN ('VERIFIED', 'GC_CLAIMED', 'DELETED')
      AND "verified_at" IS NOT NULL
      AND (
        ("status" = 'VERIFIED'
          AND "cleanup_claimed_at" IS NULL
          AND "cleanup_completed_at" IS NULL)
        OR
        ("status" = 'GC_CLAIMED'
          AND "cleanup_claimed_at" IS NOT NULL
          AND "cleanup_claimed_at" >= "verified_at"
          AND "cleanup_completed_at" IS NULL)
        OR
        ("status" = 'DELETED'
          AND "cleanup_claimed_at" IS NOT NULL
          AND "cleanup_claimed_at" >= "verified_at"
          AND "cleanup_completed_at" IS NOT NULL
          AND "cleanup_completed_at" >= "cleanup_claimed_at")
      )
    )
  );

-- Keep the verified ETag as an audit/version proof on DELETED Blob rows.
-- Historical R2 DELETED rows continue to require a null verified ETag.
ALTER TABLE "private_media_objects"
  DROP CONSTRAINT "private_media_verified_etag_chk";

ALTER TABLE "private_media_objects"
  ADD CONSTRAINT "private_media_verified_etag_chk"
  CHECK (
    (
      ("status" IN ('VERIFIED', 'GC_CLAIMED')
        OR ("storage_provider" = 'BLOB' AND "status" = 'DELETED'))
      AND "verified_at" IS NOT NULL
      AND "verified_etag" IS NOT NULL
      AND "verified_etag" ~ '^"[A-Za-z0-9-]{1,120}"$'
    )
    OR
    (
      "status" NOT IN ('VERIFIED', 'GC_CLAIMED')
      AND NOT ("storage_provider" = 'BLOB' AND "status" = 'DELETED')
      AND "verified_etag" IS NULL
    )
  );

-- No automatic cleanup or scheduler is added. FK still binds only VERIFIED.
