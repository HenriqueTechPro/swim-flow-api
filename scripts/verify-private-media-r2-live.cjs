#!/usr/bin/env node
'use strict';

/**
 * ON-DEMAND DESTRUCTIVE SMOKE: only artificial PNG bytes in a dedicated
 * disposable R2 bucket. Never runs on build, deploy, cron, push or PR.
 * Never log presigned URLs, bucket credentials, object keys or HTTP bodies.
 */
const { randomUUID } = require('node:crypto');
const { assertLiveSmokeEnvironment } = require('./private-r2-smoke-guard.cjs');

const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+p6n0AAAAASUVORK5CYII=',
  'base64',
);
const ALTERNATE = Buffer.concat([PIXEL_PNG, Buffer.from([0x00])]);

function insist(condition, code) {
  if (!condition) throw new Error(code);
}
function success(status) {
  return status >= 200 && status < 300;
}
async function requestStatus(url, init) {
  const response = await fetch(url, {
    ...init,
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
  });
  const status = response.status;
  await response.arrayBuffer(); // fixture only; never print bodies
  return status;
}
function assertCorsResponse(response, origin, method, headers) {
  insist(success(response.status), 'r2-cors-preflight-status');
  insist(
    response.headers.get('access-control-allow-origin') === origin,
    'r2-cors-origin-not-exact',
  );
  const methods = (response.headers.get('access-control-allow-methods') || '')
    .toLowerCase().split(',').map((s) => s.trim());
  insist(methods.includes(method.toLowerCase()), 'r2-cors-method-not-allowed');
  const allowed = (response.headers.get('access-control-allow-headers') || '')
    .toLowerCase().split(',').map((s) => s.trim());
  for (const header of headers) {
    insist(allowed.includes(header), 'r2-cors-required-header-not-allowed');
  }
}
async function checkCors(ticket, origin, method, headers) {
  const response = await fetch(ticket.url, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': method,
      'Access-Control-Request-Headers': headers.join(','),
    },
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
  });
  try {
    assertCorsResponse(response, origin, method, headers);
  } finally {
    await response.arrayBuffer();
  }
}

async function execute(config) {
  // Intentionally require all protected validation before importing the AWS
  // SDK or loading the project's TypeScript adapter.
  const {
    S3Client, GetObjectCommand,
  } = require('@aws-sdk/client-s3');
  const { S3PrivateMediaStorageRepository } =
    require('../src/infra/storage/s3-private-media-storage.repository.ts');

  const client = new S3Client({
    endpoint: config.endpoint,
    region: 'auto',
    forcePathStyle: true,
    maxAttempts: 1,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  const storage = new S3PrivateMediaStorageRepository(client, config.bucket);
  const keys = [];
  const owner = randomUUID();

  try {
    const key = `private/profiles/${owner}/${randomUUID()}.png`;
    keys.push(key);
    const ticket = await storage.signUpload({
      objectKey: key, contentType: 'image/png',
    });
    insist(ticket.method === 'PUT' &&
      ticket.headers['If-None-Match'] === '*' &&
      ticket.headers['Content-Type'] === 'image/png' &&
      ticket.expiresInSeconds <= 90, 'r2-put-signed-contract');
    insist(new URL(ticket.url).origin === config.endpoint,
      'r2-smoke-endpoint-unexpected');

    // Prove a browser would be allowed to send BOTH signed PUT headers.
    await checkCors(ticket, config.origin, 'PUT',
      ['content-type', 'if-none-match']);

    const results = await Promise.all([
      requestStatus(ticket.url, {
        method: 'PUT', headers: ticket.headers, body: PIXEL_PNG,
      }),
      requestStatus(ticket.url, {
        method: 'PUT', headers: ticket.headers, body: ALTERNATE,
      }),
    ]);
    insist(results.filter(success).length === 1 &&
      results.filter((status) => status === 412).length === 1,
      'r2-conditional-concurrent-put-not-atomic');
    insist(await requestStatus(ticket.url, {
      method: 'PUT', headers: ticket.headers, body: PIXEL_PNG,
    }) === 412, 'r2-reused-presigned-url-overwrote-object');

    const first = await storage.headObject(key);
    insist(first && typeof first.etag === 'string' &&
      first.contentType === 'image/png' &&
      [PIXEL_PNG.length, ALTERNATE.length].includes(first.sizeBytes),
      'r2-object-head-invalid');

    const prefix = await storage.readPrefix(key, 12, first.etag);
    insist(Buffer.from(prefix).equals(PIXEL_PNG.subarray(0, 12)),
      'r2-etag-range-prefix-invalid');

    const readTicket = await storage.signDownload(key, first.etag);
    insist(readTicket.headers['If-Match'] === first.etag &&
      readTicket.expiresInSeconds <= 60, 'r2-get-signed-contract');
    await checkCors(readTicket, config.origin, 'GET', ['if-match']);
    const get = await fetch(readTicket.url, {
      method: 'GET',
      headers: readTicket.headers,
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
    });
    insist(get.status === 200, 'r2-signed-etag-get-rejected');
    const observed = Buffer.from(await get.arrayBuffer());
    insist(observed.equals(PIXEL_PNG) || observed.equals(ALTERNATE),
      'r2-signed-etag-get-bytes-changed');

    // A wrong If-Match via authenticated SDK MUST fail with 412.
    let wrongEtagRejected = false;
    try {
      const wrong = await client.send(new GetObjectCommand({
        Bucket: config.bucket, Key: key, Range: 'bytes=0-7',
        IfMatch: '"00000000000000000000000000000000"',
      }));
      if (wrong.Body?.transformToByteArray) {
        await wrong.Body.transformToByteArray();
      }
    } catch (error) {
      wrongEtagRejected = error?.$metadata?.httpStatusCode === 412;
    }
    insist(wrongEtagRejected, 'r2-get-did-not-enforce-if-match');

    const unsigned = new URL(readTicket.url);
    unsigned.search = '';
    const unsignedStatus = await requestStatus(unsigned.toString(), {
      method: 'GET',
    });
    insist([401, 403, 404].includes(unsignedStatus),
      'r2-bucket-allows-unsigned-get');

    // Expose the known negative-read / late-PUT cleanup hazard. Deleting
    // the object releases its key; the still-valid signed PUT can create it
    // again. This is intentionally synthetic, never a real person's image.
    await storage.deleteObject(key);
    insist(await storage.headObject(key) === null,
      'r2-smoke-delete-not-effective');
    const lateReplay = await requestStatus(ticket.url, {
      method: 'PUT',
      headers: ticket.headers,
      body: PIXEL_PNG,
    });
    insist(success(lateReplay) || lateReplay === 412 ||
      lateReplay === 403, 'r2-delete-replay-response-unexpected');

    // IMPORTANT: neither a success nor a failure here permits enabling
    // production garbage collection. Actual in-flight PUTs still pose risk.
    process.stdout.write('PASS: disposable R2 SigV4 create-once, concurrent 412, conditional GET, CORS, unsigned GET denied.\n');
    process.stdout.write(
      success(lateReplay)
        ? 'OBSERVED: a valid PUT URL can recreate an object after DELETE; production cleanup remains blocked.\n'
        : 'NOTE: replay after DELETE did not succeed in this run; in-flight PUT risk remains unresolved.\n',
    );
  } finally {
    // Cleanup only keys created by this run. No ListObjects, no bucket delete,
    // no deletion by prefix and no access to production media.
    for (const key of keys) {
      try { await storage.deleteObject(key); } catch {
        process.stderr.write('SMOKE_CLEANUP_FAILED: inspect the disposable bucket privately.\n');
      }
    }
    client.destroy();
  }
}

async function main() {
  try {
    const config = assertLiveSmokeEnvironment(
      process.env, process.argv.slice(2),
    );
    await execute(config);
  } catch (error) {
    // Avoid including transport request metadata/URL or credentials in CI logs.
    const code = typeof error?.message === 'string' &&
      /^(smoke-|r2-)/.test(error.message)
      ? error.message : 'r2-smoke-live-failed-review-privately';
    process.stderr.write('FAIL: ' + code + '\n');
    process.exitCode = 1;
  }
}
if (require.main === module) void main();

module.exports = { execute, assertCorsResponse };
