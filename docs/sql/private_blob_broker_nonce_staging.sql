-- Swim Flow: FUTURE STAGING-ONLY broker replay cache.
-- REVIEW-ONLY SQL. This is NOT a Prisma migration and is not executed by CI.
-- Provision only inside a separately approved staging broker PostgreSQL DB.
-- Never execute against Swim Flow production or existing student data tables.

CREATE TABLE IF NOT EXISTS private_blob_broker_nonce_claims (
  nonce_key TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT private_blob_broker_nonce_prefix
    CHECK (nonce_key LIKE 'swim-flow-blob-staging-broker-v1:%')
);

CREATE INDEX IF NOT EXISTS private_blob_broker_nonce_expiry_idx
  ON private_blob_broker_nonce_claims (expires_at);

-- OPTIONAL maintenance only after full security review. NEVER delete a
-- nonce before the signed request's validity window has fully elapsed.
-- DELETE FROM private_blob_broker_nonce_claims
-- WHERE expires_at < NOW() - INTERVAL '2 minutes';
