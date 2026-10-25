'use strict';

/**
 * Hard stop before constructing any AWS client or performing network I/O.
 * All destructive operations must be confined to a dedicated disposable R2
 * bucket, never the production media bucket.
 */
const APPROVAL = 'I_APPROVE_DISPOSABLE_R2_SMOKE_ONLY';
const BUCKET = /^swimflow-r2-smoke-[a-z0-9][a-z0-9-]{5,40}$/;
const ENDPOINT = /^https:\/\/[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/;

function normalizeOrigin(value) {
  if (!value) throw new Error('smoke-origin-missing');
  let url;
  try { url = new URL(value); } catch {
    throw new Error('smoke-origin-invalid');
  }
  const localhost = url.protocol === 'http:' &&
    ['localhost', '127.0.0.1'].includes(url.hostname);
  if (!localhost && url.protocol !== 'https:') {
    throw new Error('smoke-origin-must-be-https');
  }
  if (url.username || url.password || url.pathname !== '/' ||
      url.search || url.hash || value !== url.origin) {
    throw new Error('smoke-origin-must-be-exact');
  }
  return url.origin;
}

function assertLiveSmokeEnvironment(env, args) {
  if (args.length !== 1 || args[0] !== '--execute' ||
      env.SWIMFLOW_R2_SMOKE_APPROVAL !== APPROVAL ||
      env.NODE_ENV === 'production') {
    throw new Error('smoke-explicit-approval-required');
  }
  const bucket = env.R2_SMOKE_BUCKET || '';
  const endpoint = env.R2_SMOKE_ENDPOINT || '';
  if (!BUCKET.test(bucket) || bucket.includes('prod') ||
      !ENDPOINT.test(endpoint)) {
    throw new Error('smoke-dedicated-bucket-and-r2-endpoint-required');
  }
  if (!env.R2_SMOKE_ACCESS_KEY_ID || !env.R2_SMOKE_SECRET_ACCESS_KEY ||
      env.R2_SMOKE_ACCESS_KEY_ID.length < 10 ||
      env.R2_SMOKE_SECRET_ACCESS_KEY.length < 16) {
    throw new Error('smoke-dedicated-credentials-required');
  }
  if (env.SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED === 'true') {
    throw new Error('smoke-live-application-storage-must-stay-disabled');
  }

  return {
    endpoint,
    bucket,
    accessKeyId: env.R2_SMOKE_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SMOKE_SECRET_ACCESS_KEY,
    origin: normalizeOrigin(env.R2_SMOKE_ORIGIN),
  };
}

module.exports = { assertLiveSmokeEnvironment, normalizeOrigin, APPROVAL };
