'use strict';

/**
 * Local, explicit, read/write smoke for ONLY the throwaway Vercel Blob store.
 * No remote requests are made by the guard. Never print identity credentials.
 */
const LAB_TEAM_ID = 'team_ONfSvrgCkVLlDaKIeFuPlrEL';
const LAB_PROJECT_ID = 'prj_amGQuKcaOIuLUdlqMYK3ltZRYC43';
const LAB_STORE_ID = 'store_pAtHIpXAePc3zgXg';
const APPROVAL = 'I_APPROVE_DISPOSABLE_PRIVATE_BLOB_OIDC_SMOKE_ONLY';

function assertDisposableOidcSmoke(env, args, link) {
  if (args.length !== 1 || args[0] !== '--execute' ||
      env.BLOB_OIDC_SMOKE_APPROVAL !== APPROVAL ||
      env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production') {
    throw new Error('blob-oidc-manual-approval-required');
  }
  if (!link || link.projectId !== LAB_PROJECT_ID ||
      link.orgId !== LAB_TEAM_ID ||
      (env.VERCEL_PROJECT_ID && env.VERCEL_PROJECT_ID !== LAB_PROJECT_ID) ||
      (env.VERCEL_ORG_ID && env.VERCEL_ORG_ID !== LAB_TEAM_ID)) {
    throw new Error('blob-oidc-lab-project-link-required');
  }
  if (env.BLOB_STORE_ID !== LAB_STORE_ID) {
    throw new Error('blob-oidc-disposable-store-id-required');
  }
  if (env.BLOB_READ_WRITE_TOKEN || env.BLOB_SMOKE_READ_WRITE_TOKEN ||
      env.VERCEL_BLOB_API_URL || env.NEXT_PUBLIC_VERCEL_BLOB_API_URL ||
      env.SWIMFLOW_PRIVATE_BLOB_ENABLED === 'true' ||
      env.SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED === 'true' ||
      env.SWIMFLOW_R2_STORAGE_ENABLED === 'true') {
    throw new Error('blob-oidc-production-storage-or-overrides-forbidden');
  }
  const oidc = env.VERCEL_OIDC_TOKEN || '';
  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(oidc) || oidc.length < 80) {
    throw new Error('blob-oidc-project-token-missing-or-invalid');
  }
  // Intentionally return NO token. The SDK reads and refreshes it itself.
  return { storeId: LAB_STORE_ID };
}

module.exports = {
  assertDisposableOidcSmoke, LAB_TEAM_ID, LAB_PROJECT_ID,
  LAB_STORE_ID, APPROVAL,
};
