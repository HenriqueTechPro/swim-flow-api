/**
 * Optional server-to-server transport for PRIVATE Blob, scoped to Render staging.
 * The browser never receives this HMAC key or the Vercel Blob URLs.
 * The provider stays OFF until explicitly opted in and all identities match.
 */
export interface PrivateBlobBrokerConfig {
  readonly endpoint: string;
  readonly sharedKey: string;
}

const STORE_ID = 'store_PJZzrdBiiVcRyLHj';
const PROJECT = 'prj_n2mFk76ZGhn5A8wnhpb7Asj8WKjz';
const HOST =
  /^swim-flow-private-blob-broker-staging-[a-z0-9]+\.vercel\.app$/;

export function loadPrivateBlobBrokerConfig(
  env: NodeJS.ProcessEnv,
): PrivateBlobBrokerConfig | null {
  if (env.SWIMFLOW_PRIVATE_BLOB_ENABLED !== 'true' ||
      env.SWIMFLOW_PRIVATE_BLOB_TRANSPORT !== 'broker') return null;

  if (
    env.SWIMFLOW_ENVIRONMENT !== 'staging' ||
    env.BLOB_STORE_ID !== STORE_ID ||
    env.BLOB_RENDER_STAGING_STORE_NAME !== 'swim-flow-private-media-staging' ||
    env.SWIMFLOW_BLOB_BROKER_PROJECT_ID !== PROJECT ||
    (env.RENDER === 'true' &&
      env.RENDER_EXTERNAL_HOSTNAME !== 'swim-flow-api-staging.onrender.com') ||
    !!env.VERCEL_OIDC_TOKEN ||
    !!env.BLOB_READ_WRITE_TOKEN ||
    !!env.BLOB_SMOKE_READ_WRITE_TOKEN ||
    env.SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED === 'true' ||
    env.SWIMFLOW_R2_STORAGE_ENABLED === 'true'
  ) throw new Error('Private Blob broker staging identity rejected');

  const key = env.SWIMFLOW_BLOB_BROKER_SHARED_KEY;
  const url = env.SWIMFLOW_BLOB_BROKER_URL;
  if (!key || !/^[A-Za-z0-9_-]{43}$/.test(key) || !url) {
    throw new Error('Private Blob broker configuration missing');
  }
  let endpoint: URL;
  try { endpoint = new URL(url); }
  catch { throw new Error('Private Blob broker URL invalid'); }
  if (
    endpoint.protocol !== 'https:' ||
    !HOST.test(endpoint.hostname) ||
    endpoint.pathname !== '/api/media' ||
    endpoint.search || endpoint.hash ||
    endpoint.username || endpoint.password ||
    endpoint.port
  ) throw new Error('Private Blob broker URL invalid');
  return { endpoint: endpoint.toString(), sharedKey: key };
}
