import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  createStagingBrokerProbeReceiver,
  isStagingBrokerEnv,
} = require('./private-blob-broker-readonly-receiver.cjs');
const {
  createAtomicPostgresNonceClaim,
} = require('./private-blob-broker-postgres-nonce.cjs');

const DATABASE_NAME = 'swimflow_blob_broker_nonce_staging';
const ROLE_NAME = 'swimflow_blob_broker_nonce_rw';
const DISABLED_HEADERS = Object.freeze({
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
});

function disabled() {
  return new Response(JSON.stringify({ code: 'broker-disabled' }), {
    status: 503, headers: DISABLED_HEADERS,
  });
}

export function isIsolatedNonceDatabase(env) {
  // Serverless functions are not permitted to reuse an app DATABASE_URL.
  if (env.DATABASE_URL || env.DIRECT_URL) return false;
  const raw = env.SWIMFLOW_BLOB_BROKER_NONCE_DATABASE_URL;
  const declaredHost = env.SWIMFLOW_BLOB_BROKER_NONCE_DB_HOST;
  if (
    typeof raw !== 'string' ||
    typeof declaredHost !== 'string' ||
    !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.neon\.tech$/.test(declaredHost)
  ) return false;

  try {
    const url = new URL(raw);
    return url.protocol === 'postgresql:' &&
      url.hostname === declaredHost &&
      (url.port === '' || url.port === '5432') &&
      url.username === ROLE_NAME &&
      url.password.length >= 16 &&
      url.pathname === '/' + DATABASE_NAME &&
      url.searchParams.size === 1 &&
      url.searchParams.get('sslmode') === 'require' &&
      !url.hash;
  } catch {
    return false;
  }
}

export function createBrokerHandler({
  env = process.env,
  now = Date.now,
  loadBlob = () => import('@vercel/blob'),
  createQuery = async (connectionString) => {
    const lib = await import('pg');
    const Pool = lib.Pool || lib.default?.Pool;
    if (typeof Pool !== 'function') throw new Error('pg-unavailable');
    const pool = new Pool({
      connectionString,
      max: 2,
      idleTimeoutMillis: 2000,
      connectionTimeoutMillis: 3000,
      statement_timeout: 3500,
    });
    pool.on('error', () => {
      // Prevent unhandled errors in idle connections; no SQL/secret logging.
    });
    return (sql, params) => pool.query(sql, params);
  },
} = {}) {
  let queryPromise;

  return {
    async fetch(request) {
      // This is NEVER enabled by deployment alone. No database connection,
      // network or Blob SDK call unless the exact preview identity, store,
      // feature flag, nonce DB and shared key are configured.
      if (
        !isStagingBrokerEnv(env) ||
        !isIsolatedNonceDatabase(env) ||
        typeof env.SWIMFLOW_BLOB_BROKER_SHARED_KEY !== 'string' ||
        env.SWIMFLOW_BLOB_BROKER_SHARED_KEY.length !== 43
      ) return disabled();

      try {
        // An SDK import does not access Blob. Any failure returns 503.
        const sdk = await loadBlob();
        if (
          typeof sdk?.head !== 'function' ||
          typeof sdk?.BlobNotFoundError !== 'function'
        ) return disabled();

        if (!queryPromise) {
          queryPromise = Promise.resolve().then(() => createQuery(
            env.SWIMFLOW_BLOB_BROKER_NONCE_DATABASE_URL,
          ));
        }
        const query = await queryPromise;
        if (typeof query !== 'function') return disabled();

        const receiver = createStagingBrokerProbeReceiver({
          env,
          now,
          head: sdk.head,
          BlobNotFoundError: sdk.BlobNotFoundError,
          claimNonce: createAtomicPostgresNonceClaim(query),
        });
        return await receiver(request);
      } catch {
        // No exception body, URL, database username or token is exposed.
        return disabled();
      }
    },
  };
}
