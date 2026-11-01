'use strict';

/**
 * Confirm the *embedded store id* of the RW token matches the explicitly
 * designated disposable store BEFORE any network call. Neither names nor
 * approval phrases alone isolate credentials.
 */
const APPROVAL = 'I_APPROVE_DISPOSABLE_PRIVATE_BLOB_SMOKE_ONLY';
const STORE_NAME = /^swim-flow-blob-smoke-[a-z0-9][a-z0-9-]{2,36}$/;
const STORE_ID = /^store_([A-Za-z0-9]{8,60})$/;
const TOKEN = /^vercel_blob_rw_([A-Za-z0-9]{8,60})_([A-Za-z0-9-]{16,})$/;
const PROTECTED_STORE_IDS = new Set(['SdzpYKLzZL6WPLHh']);

function assertPrivateBlobSmokeEnvironment(env, args) {
  if (
    args.length !== 1 ||
    args[0] !== '--execute' ||
    env.BLOB_SMOKE_APPROVAL !== APPROVAL ||
    env.NODE_ENV === 'production'
  ) throw new Error('blob-smoke-manual-approval-required');

  if (
    env.SWIMFLOW_PRIVATE_BLOB_ENABLED === 'true' ||
    env.SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED === 'true' ||
    env.SWIMFLOW_R2_STORAGE_ENABLED === 'true' ||
    env.BLOB_READ_WRITE_TOKEN ||
    env.VERCEL_OIDC_TOKEN ||
    env.BLOB_STORE_ID ||
    env.VERCEL_BLOB_API_URL ||
    env.NEXT_PUBLIC_VERCEL_BLOB_API_URL
  ) throw new Error('blob-smoke-app-storage-and-overrides-must-be-disabled');

  const name = env.BLOB_SMOKE_STORE_NAME || '';
  const storeId = env.BLOB_SMOKE_STORE_ID || '';
  const token = env.BLOB_SMOKE_READ_WRITE_TOKEN || '';
  const id = STORE_ID.exec(storeId)?.[1];
  const tokenId = TOKEN.exec(token)?.[1];

  if (
    !STORE_NAME.test(name) ||
    /prod|live|real|main|swim-flow-private-media/.test(name) ||
    !id ||
    PROTECTED_STORE_IDS.has(id)
  ) throw new Error('blob-smoke-disposable-store-and-matching-token-required');

  // New Blob project connections use OIDC and expose BLOB_STORE_ID, not a
  // long-lived RW token. GitHub-hosted runners do NOT inherit Vercel OIDC.
  // Never mistake an OIDC JWT, store id, or webhook public key for an RW token.
  // These error codes expose only the class of failure, never the credential.
  if (!token) throw new Error('blob-smoke-read-write-token-missing-oidc-unsupported');
  if (!tokenId || token.trim() !== token) {
    throw new Error('blob-smoke-read-write-token-invalid');
  }
  if (id !== tokenId) throw new Error('blob-smoke-read-write-token-store-mismatch');

  return { storeId, token };
}

module.exports = { assertPrivateBlobSmokeEnvironment, APPROVAL };
