-- Swim Flow 02E-16B.5: retain the strong ETag of the verified private object.
-- Additive and append-only; no rewrite of prior migration history.
ALTER TABLE "private_media_objects"
  ADD COLUMN "verified_etag" VARCHAR(128);

-- Existing private storage remains unactivated. A VERIFIED record must
-- identify the exact object generation verified by HEAD + conditional GET.
ALTER TABLE "private_media_objects"
  ADD CONSTRAINT "private_media_verified_etag_chk"
  CHECK (
    ("status" = 'VERIFIED'
      AND "verified_at" IS NOT NULL
      AND "verified_etag" IS NOT NULL
      AND "verified_etag" ~ '^"[A-Za-z0-9-]{1,120}"$')
    OR
    ("status" <> 'VERIFIED'
      AND "verified_etag" IS NULL)
  );
