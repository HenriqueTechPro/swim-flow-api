'use strict';

/**
 * PostgreSQL adapter for the future broker NONCE store.
 *
 * There is intentionally no DB connection or migration invocation here.
 * The *future dedicated staging broker* must inject a PostgreSQL client's
 * parameterized query(sql, values) and provision the table manually.
 *
 * Atomic UNIQUE constraint on nonce_key is mandatory. Never use a Set,
 * process-local cache or read-then-insert for production replay protection.
 */
const INSERT = [
  'INSERT INTO private_blob_broker_nonce_claims (nonce_key, expires_at)',
  'VALUES ($1, $2)',
  'ON CONFLICT (nonce_key) DO NOTHING',
  'RETURNING nonce_key',
].join(' ');

const NONCE_KEY = /^swim-flow-blob-staging-broker-v1:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function createAtomicPostgresNonceClaim(query) {
  if (typeof query !== 'function') {
    throw new Error('broker-nonce-durable-store-required');
  }

  return async function claimNonce(nonceKey, expiresAtMs) {
    if (
      typeof nonceKey !== 'string' ||
      !NONCE_KEY.test(nonceKey) ||
      !Number.isSafeInteger(expiresAtMs) ||
      expiresAtMs < 0 ||
      expiresAtMs > 8640000000000000
    ) {
      return false;
    }
    // INSERT ... ON CONFLICT is the one atomic statement used for replay
    // rejection. Never DELETE a nonce before its signed request expires.
    const result = await query(INSERT, [nonceKey, new Date(expiresAtMs)]);
    return (
      result?.rowCount === 1 &&
      Array.isArray(result.rows) &&
      result.rows.length === 1 &&
      result.rows[0]?.nonce_key === nonceKey
    );
  };
}

module.exports = { createAtomicPostgresNonceClaim };
