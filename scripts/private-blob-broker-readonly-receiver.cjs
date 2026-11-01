'use strict';

/**
 * Fail-closed, framework-independent proof receiver. NOT registered as a
 * NestJS route or Vercel Function. No storage access is possible unless
 * a caller provides durable atomic claimNonce and @vercel/blob HEAD.
 *
 * Only a synthetic HEAD is supported. Never handles athlete image keys.
 */
const { verifyStagingReadOnlyProbe } = require('./private-blob-broker-auth-v1.cjs');

const STORE_ID = 'store_PJZzrdBiiVcRyLHj';
const FORBIDDEN_PROJECT_IDS = new Set([
  'prj_amGQuKcaOIuLUdlqMYK3ltZRYC43', // disposable OIDC smoke lab
  'prj_GH6wd4vwTJb9sHkP8sGXSAUleE5P', // shared dashboard staging
]);
const MAX_BODY_BYTES = 1024;
const BASE_HEADERS = {
  'Cache-Control': 'private, no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

function reply(status, code) {
  return new Response(JSON.stringify({ code }), {
    status,
    headers: BASE_HEADERS,
  });
}

function isStagingBrokerEnv(env) {
  const projectId = env.VERCEL_PROJECT_ID;
  return env.SWIMFLOW_BLOB_BROKER_READONLY_ENABLED === 'true' &&
    env.VERCEL_ENV === 'preview' &&
    env.BLOB_STORE_ID === STORE_ID &&
    typeof projectId === 'string' &&
    /^prj_[A-Za-z0-9]{12,60}$/.test(projectId) &&
    !FORBIDDEN_PROJECT_IDS.has(projectId) &&
    env.SWIMFLOW_BLOB_BROKER_PROJECT_ID === projectId &&
    env.SWIMFLOW_PRIVATE_BLOB_ENABLED !== 'true' &&
    env.SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED !== 'true' &&
    env.SWIMFLOW_R2_STORAGE_ENABLED !== 'true' &&
    !env.BLOB_READ_WRITE_TOKEN &&
    !env.BLOB_SMOKE_READ_WRITE_TOKEN &&
    !env.BLOB_SMOKE_STORE_ID &&
    !env.VERCEL_BLOB_API_URL &&
    !env.NEXT_PUBLIC_VERCEL_BLOB_API_URL &&
    typeof env.VERCEL_OIDC_TOKEN === 'string' &&
    env.VERCEL_OIDC_TOKEN.length > 0;
}

async function readSmallJson(request) {
  const rawLength = request.headers.get('content-length');
  if (rawLength !== null) {
    if (!/^[0-9]{1,4}$/.test(rawLength)) return { error: 413 };
    const declared = Number(rawLength);
    if (declared < 1 || declared > MAX_BODY_BYTES) return { error: 413 };
  }
  if (!request.body) return { error: 400 };
  const reader = request.body.getReader();
  const buffers = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {});
        return { error: 413 };
      }
      buffers.push(value);
    }
    if (total === 0) return { error: 400 };
    const joined = new Uint8Array(total);
    let offset = 0;
    for (const chunk of buffers) {
      joined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const text = new TextDecoder('utf-8', { fatal: true }).decode(joined);
    return { data: JSON.parse(text) };
  } catch {
    return { error: 400 };
  } finally {
    reader.releaseLock();
  }
}

function createStagingBrokerProbeReceiver({
  env, claimNonce, head, BlobNotFoundError, now = Date.now,
}) {
  return async function receive(request) {
    // No header or request body is logged; errors are fixed categories.
    if (!isStagingBrokerEnv(env) ||
        typeof claimNonce !== 'function' ||
        typeof head !== 'function' ||
        typeof BlobNotFoundError !== 'function' ||
        typeof env.SWIMFLOW_BLOB_BROKER_SHARED_KEY !== 'string') {
      return reply(503, 'broker-disabled');
    }
    if (!(request instanceof Request)) return reply(400, 'invalid-request');
    const url = new URL(request.url);
    if (url.pathname !== '/api/probe' || url.search) {
      return reply(404, 'not-found');
    }
    if (request.method !== 'POST') return reply(405, 'method-not-allowed');
    if (request.headers.get('origin')) return reply(403, 'origin-not-allowed');
    if (request.headers.get('content-type') !== 'application/json') {
      return reply(415, 'unsupported-media-type');
    }

    const body = await readSmallJson(request);
    if (body.error) return reply(body.error, 'invalid-request');

    let probe;
    try {
      probe = await verifyStagingReadOnlyProbe(
        env.SWIMFLOW_BLOB_BROKER_SHARED_KEY,
        body.data,
        { nowMs: now(), claimNonce },
      );
    } catch {
      return reply(401, 'unauthorized');
    }

    try {
      // No RW token, no explicit OIDC token: SDK reads rotating credentials
      // provided by the *future dedicated staging project*.
      const metadata = await head(probe.pathname, {
        abortSignal: AbortSignal.timeout(8000),
      });
      // Synthetic random key MUST be absent; never return object metadata.
      if (metadata) return reply(409, 'unexpected-probe-object');
      return reply(502, 'invalid-blob-response');
    } catch (error) {
      if (error instanceof BlobNotFoundError) {
        return reply(200, 'synthetic-head-not-found');
      }
      return reply(502, 'blob-head-unavailable');
    }
  };
}

module.exports = { createStagingBrokerProbeReceiver, isStagingBrokerEnv };
