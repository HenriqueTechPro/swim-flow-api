/**
 * Strict, opt-in configuration for a future private Cloudflare R2 adapter.
 * This module is NOT wired into HttpModule yet. No calls to R2 occur here.
 * Only the server may read these credentials; never put them in VITE_*.
 */
export interface PrivateR2Config {
  endpoint: string;
  region: 'auto';
  bucket: string;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

const accountIdPattern = /^[0-9a-f]{32}$/i;
const bucketPattern = /^(?!-)[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

export function loadPrivateR2Config(
  values: NodeJS.ProcessEnv,
): PrivateR2Config | null {
  const enabled = values.SWIMFLOW_R2_STORAGE_ENABLED;
  if (enabled === undefined || enabled === 'false') return null;
  if (enabled !== 'true') {
    throw new Error('Invalid private object storage feature flag');
  }

  const accountId = values.R2_ACCOUNT_ID?.trim();
  const bucket = values.R2_PRIVATE_BUCKET?.trim();
  const accessKeyId = values.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = values.R2_SECRET_ACCESS_KEY?.trim();

  // Do not interpolate the secret or input values into the exception.
  if (
    !accountId || !accountIdPattern.test(accountId) ||
    !bucket || !bucketPattern.test(bucket) ||
    !accessKeyId || accessKeyId.length < 8 ||
    !secretAccessKey || secretAccessKey.length < 16
  ) {
    throw new Error('Private object storage configuration is missing or invalid');
  }

  return {
    endpoint: `https://${accountId.toLowerCase()}.r2.cloudflarestorage.com`,
    region: 'auto',
    bucket,
    credentials: { accessKeyId, secretAccessKey },
  };
}
