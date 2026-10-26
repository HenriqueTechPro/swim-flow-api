/**
 * Strict, server-only, opt-in config for PRIVATE Vercel Blob.
 *
 * This module does not construct an SDK client, make requests, or register
 * any Nest provider. Never expose the token through VITE_* or HTTP responses.
 */
export interface PrivateVercelBlobConfig {
  readonly provider: 'vercel-blob';
  readonly access: 'private';
  readonly token: string;
}

const MIN_TOKEN_LENGTH = 32;

export function loadPrivateVercelBlobConfig(
  env: NodeJS.ProcessEnv,
): PrivateVercelBlobConfig | null {
  const enabled = env.SWIMFLOW_PRIVATE_BLOB_ENABLED;
  if (enabled === undefined || enabled === 'false') return null;
  if (enabled !== 'true') {
    throw new Error('Invalid private Blob feature flag');
  }

  // Prevent two competing storage backends from being activated together.
  if (
    env.SWIMFLOW_R2_STORAGE_ENABLED === 'true' ||
    env.SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED === 'true'
  ) {
    throw new Error('Multiple private media backends cannot be enabled');
  }

  const token = env.BLOB_READ_WRITE_TOKEN;
  if (
    !token ||
    token.length < MIN_TOKEN_LENGTH ||
    token.trim() !== token ||
    /[\r\n\s]/.test(token)
  ) {
    // Never echo env contents or token fragments in error messages.
    throw new Error('Private Blob token is missing or invalid');
  }

  return { provider: 'vercel-blob', access: 'private', token };
}
