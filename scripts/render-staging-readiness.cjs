#!/usr/bin/env node
'use strict';

/**
 * 02F-06B4 — read-only readiness probe for the dedicated Render staging API.
 * Only GET /health and /health/ready on the single approved HTTPS origin.
 * Never sends credentials, changes DB, triggers deployment, or enables Blob.
 */
const EXPECTED_ORIGIN = 'https://swim-flow-api-staging.onrender.com';
const EXPECTED_SERVICE = 'swim-flow-nest-api';
const MAX_RESPONSE_BYTES = 4096;

function assertStagingOrigin(origin) {
  if (typeof origin !== 'string') throw new Error('Invalid staging origin');
  let url;
  try {
    url = new URL(origin);
  } catch {
    throw new Error('Invalid staging origin');
  }
  if (url.href !== EXPECTED_ORIGIN + '/' ||
      url.protocol !== 'https:' ||
      url.username || url.password || url.search || url.hash) {
    throw new Error('Unapproved API origin: only dedicated Render staging is allowed');
  }
  return EXPECTED_ORIGIN;
}

async function readHealth(fetchImpl, origin, path, timeoutMs) {
  const response = await fetchImpl(origin + path, {
    method: 'GET',
    redirect: 'error',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response || !Number.isInteger(response.status) ||
      typeof response.text !== 'function') {
    throw new Error('Invalid health response');
  }
  const contentLength = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    throw new Error('Oversized health response');
  }
  const raw = await response.text();
  if (typeof raw !== 'string' || Buffer.byteLength(raw, 'utf8') > MAX_RESPONSE_BYTES) {
    throw new Error('Oversized health response');
  }
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new Error('Invalid health JSON');
  }
  if (body === null || Array.isArray(body) || typeof body !== 'object' ||
      body.service !== EXPECTED_SERVICE) {
    throw new Error('Unexpected staging service identity');
  }
  return { status: response.status, body };
}

async function probeStagingReadiness({
  origin = EXPECTED_ORIGIN,
  fetchImpl = fetch,
  timeoutMs = 90000,
} = {}) {
  const trustedOrigin = assertStagingOrigin(origin);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120000) {
    throw new Error('Invalid health timeout');
  }
  const live = await readHealth(fetchImpl, trustedOrigin, '/health', timeoutMs);
  if (live.status !== 200 || live.body.status !== 'ok') {
    throw new Error('Render staging liveness is not healthy');
  }
  const ready = await readHealth(fetchImpl, trustedOrigin, '/health/ready', timeoutMs);
  if (ready.status !== 200 || ready.body.status !== 'ready' ||
      ready.body.dependency !== 'postgresql') {
    throw new Error('Render staging PostgreSQL readiness not confirmed');
  }
  return { status: 'READY', service: EXPECTED_SERVICE, dependency: 'postgresql' };
}

async function main(args) {
  try {
    if (args.length === 1 && args[0] === '--check') {
      assertStagingOrigin(EXPECTED_ORIGIN);
      process.stdout.write('PASS: fixed Render staging HTTPS origin. Offline only; no network or writes.\n');
      return;
    }
    if (args.length !== 1 || args[0] !== '--probe') {
      throw new Error('Expected --check or --probe');
    }
    await probeStagingReadiness();
    process.stdout.write('READY: dedicated Render staging liveness and PostgreSQL connectivity confirmed (read-only).\n');
  } catch {
    // Do not emit response bodies, secret headers, or network exception details.
    process.stderr.write('BLOCKED: Render staging readiness could not be verified. No writes attempted.\n');
    process.exitCode = 1;
  }
}
if (require.main === module) void main(process.argv.slice(2));
module.exports = { EXPECTED_ORIGIN, assertStagingOrigin, probeStagingReadiness, main };
