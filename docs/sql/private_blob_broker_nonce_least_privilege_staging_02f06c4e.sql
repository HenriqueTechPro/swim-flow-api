-- Swim Flow 02F-06C4E: PROPOSAL ONLY, DO NOT AUTO-EXECUTE.
--
-- Intended for Neon STAGING project raspy-breeze-33258358 only,
-- in a NEW database named swimflow_blob_broker_nonce_staging,
-- NOT in the existing "swimflow" application database or production.
-- CREATE DATABASE / role separately after owner review; neither is
-- automatically created by this file.
--
-- Run as the dedicated database OWNER after confirming:
--   SELECT current_database(), current_user;
-- Expected database: swimflow_blob_broker_nonce_staging.
-- Expected owner: an administrator; NOT swimflow_blob_broker_nonce_rw.
--
-- Important: Never run without verifying the target database/branch first.

BEGIN;

-- Keep anonymous/default roles from connecting to / creating tables in
-- the dedicated database. These statements require database ownership.
REVOKE ALL PRIVILEGES ON DATABASE swimflow_blob_broker_nonce_staging FROM PUBLIC;
GRANT CONNECT ON DATABASE swimflow_blob_broker_nonce_staging
  TO swimflow_blob_broker_nonce_rw;

-- The runtime role must never be able to create arbitrary SQL objects.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO swimflow_blob_broker_nonce_rw;

CREATE TABLE IF NOT EXISTS public.private_blob_broker_nonce_claims (
  nonce_key TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT private_blob_broker_nonce_prefix
    CHECK (nonce_key LIKE 'swim-flow-blob-staging-broker-v1:%')
);

CREATE INDEX IF NOT EXISTS private_blob_broker_nonce_expiry_idx
  ON public.private_blob_broker_nonce_claims (expires_at);

REVOKE ALL PRIVILEGES ON TABLE public.private_blob_broker_nonce_claims FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.private_blob_broker_nonce_claims
  FROM swimflow_blob_broker_nonce_rw;

-- Both SELECT and INSERT are needed for INSERT ... RETURNING nonce_key.
-- No DELETE, UPDATE, TRUNCATE, REFERENCES, TRIGGER or schema CREATE.
GRANT SELECT, INSERT
  ON TABLE public.private_blob_broker_nonce_claims
  TO swimflow_blob_broker_nonce_rw;

COMMIT;

-- Read-only privilege checks for review:
-- SELECT current_database(), current_user;
-- SELECT has_database_privilege('swimflow_blob_broker_nonce_rw',
--   current_database(), 'CONNECT') AS can_connect;
-- SELECT has_database_privilege('swimflow_blob_broker_nonce_rw',
--   current_database(), 'CREATE') AS cannot_create_db_objects;
-- SELECT has_schema_privilege('swimflow_blob_broker_nonce_rw',
--   'public', 'CREATE') AS cannot_create_schema_objects;
-- SELECT has_table_privilege('swimflow_blob_broker_nonce_rw',
--   'public.private_blob_broker_nonce_claims', 'INSERT') AS can_claim;
-- SELECT has_table_privilege('swimflow_blob_broker_nonce_rw',
--   'public.private_blob_broker_nonce_claims', 'DELETE') AS cannot_delete;
--
-- Before activation, all checks must be explicitly reviewed. A role
-- with inherited owner/admin privileges is NOT suitable even if
-- the object-level grants above appear restricted.
