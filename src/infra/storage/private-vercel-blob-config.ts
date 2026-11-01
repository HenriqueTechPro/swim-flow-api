/**
 * Server-only transport configuration for PRIVATE Vercel Blob.
 *
 * This is a deliberate STAGING-ONLY activation boundary. Render cannot use
 * an OIDC identity obtained from a Vercel project on a developer machine.
 * Production activation requires a separately audited configuration change.
 *
 * The HTTP services already use this loader; flag=false returns null and
 * the existing upload/read/activate handlers return 503 without storage I/O.
 */
export interface PrivateVercelBlobConfig {
  readonly provider: 'vercel-blob';
  readonly access: 'private';
  readonly token: string;
}

const STAGING_STORE_ID = 'store_PJZzrdBiiVcRyLHj';
const STAGING_STORE_NAME = 'swim-flow-private-media-staging';
// A *legitimate* static RW token embeds the store ID. Never attempt to
// synthesize or reconstruct a token from BLOB_STORE_ID alone.
const STATIC_RW_TOKEN = /^vercel_blob_rw_([A-Za-z0-9]{8,60})_([A-Za-z0-9_-]{16,})$/;

export function loadPrivateVercelBlobConfig(
  env: NodeJS.ProcessEnv,
): PrivateVercelBlobConfig | null {
  const enabled = env.SWIMFLOW_PRIVATE_BLOB_ENABLED;
  if (enabled === undefined || enabled === 'false') return null;
  if (enabled !== 'true') {
    throw new Error('Invalid private Blob feature flag');
  }

  // Refuse production, disposable lab and accidentally copied credentials
  // BEFORE constructing any storage adapter. NODE_ENV=production is normal
  // for Render staging: use a separate explicit deployment-stage identity.
  if (
    env.SWIMFLOW_ENVIRONMENT !== 'staging' ||
    env.BLOB_STORE_ID !== STAGING_STORE_ID ||
    env.BLOB_RENDER_STAGING_STORE_NAME !== STAGING_STORE_NAME ||
    (env.RENDER === 'true' &&
      env.RENDER_EXTERNAL_HOSTNAME !== 'swim-flow-api-staging.onrender.com')
  ) {
    throw new Error('Private Blob staging identity is missing or invalid');
  }

  if (
    env.SWIMFLOW_R2_STORAGE_ENABLED === 'true' ||
    env.SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED === 'true'
  ) {
    throw new Error('Multiple private media backends cannot be enabled');
  }

  // OIDC from "vercel env pull" belongs to a Vercel project/environment.
  // It must never be copied to Render as if it were an enduring secret.
  if (
    env.VERCEL_OIDC_TOKEN ||
    env.BLOB_SMOKE_READ_WRITE_TOKEN ||
    env.BLOB_SMOKE_STORE_ID ||
    env.VERCEL_BLOB_API_URL ||
    env.NEXT_PUBLIC_VERCEL_BLOB_API_URL
  ) {
    throw new Error('Private Blob mixed or disposable credentials forbidden');
  }

  const token = env.BLOB_READ_WRITE_TOKEN ?? '';
  const match = STATIC_RW_TOKEN.exec(token);
  if (
    !match ||
    token.trim() !== token ||
    'store_' + match[1] !== STAGING_STORE_ID
  ) {
    // Do not interpolate any values or token fragments into this message.
    throw new Error('Private Blob staging credential is missing or invalid');
  }

  return { provider: 'vercel-blob', access: 'private', token };
}
