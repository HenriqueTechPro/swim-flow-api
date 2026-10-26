-- Swim Flow 02E-17F — add-only migration: reserve aged unbound private Blob
-- records atomically BEFORE any future remote delete. No files deleted here.
ALTER TABLE "private_media_objects"
  ADD COLUMN "cleanup_claimed_at" TIMESTAMPTZ(6);

-- BLOB uploads are server-side, with no presigned ticket. Claimed media
-- remains versioned, but MUST NOT be eligible for an active binding.
-- R2 ticket and state semantics are unchanged.
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
    )
    OR
    (
      "storage_provider" = 'BLOB'
      AND "ticket_expires_at" IS NULL
      AND "status" IN ('VERIFIED', 'GC_CLAIMED')
      AND "verified_at" IS NOT NULL
      AND (
        ("status" = 'VERIFIED' AND "cleanup_claimed_at" IS NULL)
        OR
        ("status" = 'GC_CLAIMED' AND "cleanup_claimed_at" IS NOT NULL
          AND "cleanup_claimed_at" >= "verified_at")
      )
    )
  );

-- The exact object ETag must be retained while GC is claimed, so a future
-- DELETE uses If-Match. Other non-VERIFIED R2 states still require null.
ALTER TABLE "private_media_objects"
  DROP CONSTRAINT "private_media_verified_etag_chk";

ALTER TABLE "private_media_objects"
  ADD CONSTRAINT "private_media_verified_etag_chk"
  CHECK (
    (
      "status" IN ('VERIFIED', 'GC_CLAIMED')
      AND "verified_at" IS NOT NULL
      AND "verified_etag" IS NOT NULL
      AND "verified_etag" ~ '^"[A-Za-z0-9-]{1,120}"$'
    )
    OR
    (
      "status" NOT IN ('VERIFIED', 'GC_CLAIMED')
      AND "verified_etag" IS NULL
    )
  );

-- The FK defined in 02E-17D includes status='VERIFIED'. A concurrent
-- assignment holds a KEY SHARE lock on the referenced row; a status update
-- takes FOR UPDATE and conflicts. No binding can point at GC_CLAIMED.
