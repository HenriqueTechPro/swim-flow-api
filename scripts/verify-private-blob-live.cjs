#!/usr/bin/env node
'use strict';

/**
 * MANUAL, DESTRUCTIVE, DISPOSABLE-STORE-ONLY smoke. No real swimmer photos.
 * Never runs in CI PR, deploy, production, scheduled jobs, or API routes.
 */
const { randomUUID } = require('node:crypto');
const { assertPrivateBlobSmokeEnvironment } =
  require('./private-blob-smoke-guard.cjs');

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+p6n0AAAAASUVORK5CYII=',
  'base64',
);
const WRONG_ETAG = '"00000000000000000000000000000000"';

function check(condition, reason) {
  if (!condition) throw new Error('blob-smoke-' + reason);
}
function boundedStream(stream) {
  return (async () => {
    const chunks = [];
    let length = 0;
    for await (const chunk of stream) {
      length += chunk.length;
      check(length <= 1024, 'unexpected-stream-size');
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  })();
}
function expectedHost(storeId) {
  return storeId.slice('store_'.length).toLowerCase() +
    '.private.blob.vercel-storage.com';
}
function verifyUrl(url, key, host) {
  const parsed = new URL(url);
  check(parsed.protocol === 'https:' &&
    parsed.hostname === host &&
    parsed.pathname === '/' + key &&
    !parsed.search && !parsed.hash &&
    !parsed.username && !parsed.password,
  'unexpected-private-store-host');
}

async function execute(config) {
  // Load production code ONLY after guard checked token's embedded store id.
  const { BlobNotFoundError, head } = require('@vercel/blob');
  const { VercelPrivateBlobStorageRepository } =
    require('../src/infra/storage/private-vercel-blob-storage.repository.ts');
  const storage = new VercelPrivateBlobStorageRepository(config.token);
  const host = expectedHost(config.storeId);
  const key = `private/profiles/${randomUUID()}/${randomUUID()}.png`;
  let createdEtag = null;
  let attemptedPut = false;
  let completed = false;

  try {
    // Random UUID path must be absent before writing. The token is scoped to
    // the exact disposable store; no prefix listing or other deletions.
    check(await storage.stat(key) === null, 'synthetic-key-exists');
    attemptedPut = true;
    const stored = await storage.put({
      pathname: key,
      contentType: 'image/png',
      bytes: PNG,
    });
    createdEtag = stored.etag;
    check(stored.pathname === key &&
      stored.sizeBytes === PNG.length &&
      stored.contentType === 'image/png',
    'upload-metadata-mismatch');

    const remote = await head(key, { token: config.token });
    verifyUrl(remote.url, key, host);
    check(remote.etag === createdEtag, 'head-etag-mismatch');

    // Direct anonymous fetch must never expose private image bytes.
    const anonymous = await fetch(remote.url, {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(12000),
    });
    const anonymousStatus = anonymous.status;
    await anonymous.arrayBuffer(); // fixture only, never log response body
    check([401, 403, 404].includes(anonymousStatus),
      'unsigned-private-get-was-allowed');

    const retrieved = await storage.get(key, createdEtag);
    check(retrieved && retrieved.etag === createdEtag &&
      retrieved.sizeBytes === PNG.length, 'private-read-metadata');
    const bytes = await boundedStream(retrieved.stream);
    check(bytes.equals(PNG), 'private-read-bytes');

    let replayRejected = false;
    try {
      await storage.put({ pathname: key, contentType: 'image/png', bytes: PNG });
    } catch { replayRejected = true; }
    check(replayRejected, 'duplicate-put-overwrote');

    let mismatchRejected = false;
    try {
      await storage.delete(key, WRONG_ETAG);
    } catch { mismatchRejected = true; }
    check(mismatchRejected, 'wrong-etag-delete-accepted');
    const unchanged = await storage.stat(key);
    check(unchanged && unchanged.etag === createdEtag,
      'wrong-etag-mutated-object');

    await storage.delete(key, createdEtag);
    const absent = await storage.stat(key);
    check(absent === null, 'conditional-delete-not-confirmed');
    completed = true;
    process.stdout.write(
      'PASS: disposable private Blob: create once, HEAD, private GET, anonymous denied, ETag-conditioned DELETE, 404.\n',
    );
  } finally {
    // Only the one synthetic key minted by this execution is ever touched.
    // Without a verified receipt, remote state is uncertain: fail closed and
    // require human inspection of the disposable store, not blind DELETE.
    if (attemptedPut && !completed) {
      if (!createdEtag) {
        process.stderr.write('SMOKE_ORPHAN_REVIEW_REQUIRED: check the disposable store privately.\n');
        throw new Error('blob-smoke-unverified-upload-may-exist');
      }
      try {
        const result = await storage.stat(key);
        if (result !== null) {
          check(result.etag === createdEtag, 'cleanup-etag-conflict');
          await storage.delete(key, createdEtag);
          check(await storage.stat(key) === null, 'cleanup-not-confirmed');
        }
      } catch {
        process.stderr.write('SMOKE_CLEANUP_FAILED: inspect only the synthetic object privately.\n');
        throw new Error('blob-smoke-cleanup-failed');
      }
    }
  }
}

async function main() {
  try {
    const config = assertPrivateBlobSmokeEnvironment(
      process.env, process.argv.slice(2),
    );
    await execute(config);
  } catch (error) {
    const message = typeof error?.message === 'string' &&
      /^blob-smoke-[a-z-]+$/.test(error.message)
      ? error.message : 'blob-smoke-failed-review-privately';
    process.stderr.write('FAIL: ' + message + '\n');
    process.exitCode = 1;
  }
}
if (require.main === module) void main();
module.exports = { execute, expectedHost, verifyUrl };
