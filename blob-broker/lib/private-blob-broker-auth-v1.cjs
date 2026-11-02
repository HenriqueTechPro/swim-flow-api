'use strict';

/**
 * Offline-only foundation of a future Render -> Vercel Blob staging broker.
 *
 * This does NOT expose HTTP handlers, deploy Vercel Functions, read Blob data,
 * create a Vercel token or enable media routes. It deliberately authenticates
 * ONLY a read-only HEAD against a fresh, synthetic, non-photo key.
 *
 * The verifier requires an injected ATOMIC, DURABLE nonce claim (e.g. an
 * INSERT with a unique constraint). In-memory Sets are NOT production-safe
 * for a serverless service. Never deploy an endpoint without this dependency.
 */
const { createHmac, randomUUID, timingSafeEqual } = require('node:crypto');

const AUDIENCE = 'swim-flow-blob-staging-broker-v1';
const OPERATION = 'head';
const MAX_SKEW_MS = 30000;
const PROBE_PATH = /^__swimflow-broker-probe\/v1\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.txt$/;
const NONCE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SIGNATURE = /^[A-Za-z0-9_-]{43}$/;
const FIELDS = ['audience', 'issuedAtMs', 'nonce', 'operation', 'pathname', 'signature', 'version'];

function deny() {
  // Static message; never interpolate a token, pathname or request body.
  throw new Error('blob-broker-probe-not-authorized');
}

function secretBytes(secret) {
  if (typeof secret !== 'string' || !SIGNATURE.test(secret)) deny();
  const bytes = Buffer.from(secret, 'base64url');
  if (bytes.length !== 32 || bytes.toString('base64url') !== secret) deny();
  return bytes;
}

function canonical(input) {
  return [
    'swimflow-blob-broker-probe/v1',
    input.version,
    input.audience,
    input.operation,
    input.pathname,
    input.issuedAtMs,
    input.nonce,
  ].join('\n');
}

function signature(bytes, envelope) {
  return createHmac('sha256', bytes).update(canonical(envelope), 'utf8').digest('base64url');
}

function createStagingReadOnlyProbe(secret, nowMs = Date.now()) {
  const bytes = secretBytes(secret);
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) deny();
  const envelope = {
    version: 1,
    audience: AUDIENCE,
    operation: OPERATION,
    pathname: '__swimflow-broker-probe/v1/' + randomUUID() + '.txt',
    issuedAtMs: nowMs,
    nonce: randomUUID(),
  };
  return Object.freeze({ ...envelope, signature: signature(bytes, envelope) });
}

/**
 * claimNonce(nonce, expiresAtMs) MUST be backed by an atomic durable uniqueness
 * constraint shared across all function instances. It returns true only when
 * this nonce is newly claimed. Any error/false fails closed.
 */
async function verifyStagingReadOnlyProbe(secret, envelope, options) {
  const bytes = secretBytes(secret);
  if (
    !envelope || typeof envelope !== 'object' ||
    Array.isArray(envelope) ||
    Object.keys(envelope).sort().join(',') !== FIELDS.join(',') ||
    envelope.version !== 1 ||
    envelope.audience !== AUDIENCE ||
    envelope.operation !== OPERATION ||
    typeof envelope.pathname !== 'string' ||
    !PROBE_PATH.test(envelope.pathname) ||
    typeof envelope.nonce !== 'string' ||
    !NONCE.test(envelope.nonce) ||
    typeof envelope.signature !== 'string' ||
    !SIGNATURE.test(envelope.signature) ||
    !Number.isSafeInteger(envelope.issuedAtMs) ||
    !options || !Number.isSafeInteger(options.nowMs) ||
    typeof options.claimNonce !== 'function' ||
    Math.abs(options.nowMs - envelope.issuedAtMs) > MAX_SKEW_MS
  ) deny();

  const expected = Buffer.from(signature(bytes, envelope), 'base64url');
  const provided = Buffer.from(envelope.signature, 'base64url');
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) deny();

  // Reserve the nonce only after signature validation to avoid poisoning
  // the replay store with unauthenticated requests.
  let claimed = false;
  try {
    claimed = await options.claimNonce(
      AUDIENCE + ':' + envelope.nonce,
      envelope.issuedAtMs + MAX_SKEW_MS + 1000,
    );
  } catch {
    deny();
  }
  if (claimed !== true) deny();

  return Object.freeze({ operation: OPERATION, pathname: envelope.pathname });
}

module.exports = {
  AUDIENCE,
  createStagingReadOnlyProbe,
  verifyStagingReadOnlyProbe,
};
