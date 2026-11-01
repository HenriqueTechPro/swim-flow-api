'use strict';

/**
 * Staging-only, OFF-by-default credential boundary for the Nest API on Render.
 * No environment is modified; neither this module nor its --check path
 * makes network calls. Keep the private staging store entirely separate
 * from production and from the disposable OIDC-only smoke lab.
 */
const STAGING_STORE_ID = 'store_PJZzrdBiiVcRyLHj';
const STAGING_STORE_NAME = 'swim-flow-private-media-staging';
const APPROVAL = 'I_APPROVE_STAGING_PRIVATE_BLOB_READ_ONLY_HEAD';
const TOKEN_RE = /^vercel_blob_rw_([A-Za-z0-9]{8,60})_([A-Za-z0-9_-]{16,})$/;

function classify(env) {
  if (env.SWIMFLOW_ENVIRONMENT !== 'staging' ||
      env.BLOB_STORE_ID !== STAGING_STORE_ID ||
      env.BLOB_RENDER_STAGING_STORE_NAME !== STAGING_STORE_NAME) {
    return 'identity-not-staging';
  }
  if (env.SWIMFLOW_PRIVATE_BLOB_ENABLED !== 'false' ||
      env.SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED === 'true' ||
      env.SWIMFLOW_R2_STORAGE_ENABLED === 'true') {
    return 'private-media-must-remain-disabled';
  }
  if (env.VERCEL_OIDC_TOKEN || env.BLOB_SMOKE_READ_WRITE_TOKEN ||
      env.BLOB_SMOKE_STORE_ID || env.VERCEL_BLOB_API_URL ||
      env.NEXT_PUBLIC_VERCEL_BLOB_API_URL) {
    return 'oidc-or-disposable-credentials-forbidden';
  }
  const token = env.BLOB_READ_WRITE_TOKEN || '';
  if (!token) return 'static-rw-credential-not-configured';
  const match = TOKEN_RE.exec(token);
  if (!match || token.trim() !== token) {
    return 'static-rw-credential-format-invalid';
  }
  if ('store_' + match[1] !== STAGING_STORE_ID) {
    return 'static-rw-credential-wrong-store';
  }
  return 'ready-for-manual-readonly-probe';
}

function assertRenderBlobStagingReadOnly(env, args) {
  if (args.length !== 1 || args[0] !== '--execute' ||
      env.BLOB_RENDER_STAGING_APPROVAL !== APPROVAL ||
      env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production') {
    throw new Error('render-blob-readonly-manual-approval-required');
  }
  const state = classify(env);
  if (state !== 'ready-for-manual-readonly-probe') {
    // All status strings are fixed: never print or interpolate credentials.
    throw new Error('render-blob-' + state);
  }
  return { storeId: STAGING_STORE_ID, token: env.BLOB_READ_WRITE_TOKEN };
}

module.exports = {
  STAGING_STORE_ID, STAGING_STORE_NAME, APPROVAL, classify,
  assertRenderBlobStagingReadOnly,
};
