'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const {
  EXPECTED_ORIGIN, assertStagingOrigin, probeStagingReadiness,
} = require('./render-staging-readiness.cjs');

function stubFetch({ readyStatus = 200, readyBody, livenessBody } = {}) {
  const requests = [];
  const impl = async (url, options) => {
    requests.push({ url, options });
    const isReady = url.endsWith('/health/ready');
    const body = isReady
      ? (readyBody ?? { status: 'ready', service: 'swim-flow-nest-api', dependency: 'postgresql' })
      : (livenessBody ?? { status: 'ok', service: 'swim-flow-nest-api' });
    return {
      status: isReady ? readyStatus : 200,
      headers: { get: () => null },
      text: async () => JSON.stringify(body),
    };
  };
  return { impl, requests };
}

test('origin is pinned: rejects production, lookalikes, query, credentials and cleartext', () => {
  assert.equal(assertStagingOrigin(EXPECTED_ORIGIN), EXPECTED_ORIGIN);
  for (const bad of [
    'http://swim-flow-api-staging.onrender.com',
    'https://swim-flow-api.onrender.com',
    'https://swim-flow-api-staging.onrender.com.attacker.test',
    'https://swim-flow-api-staging.onrender.com@attacker.test',
    'https://swim-flow-api-staging.onrender.com/other',
    'https://swim-flow-api-staging.onrender.com?token=x',
    'https://swim-flow-api-staging.onrender.com:444',
    'https://swim-flow-api-staging.onrender.com/#fragment',
    'not-a-url',
    null,
  ]) assert.throws(() => assertStagingOrigin(bad));
});

test('only anonymous GET /health and /health/ready; no redirects or credentials', async () => {
  const { impl, requests } = stubFetch();
  const result = await probeStagingReadiness({ fetchImpl: impl, timeoutMs: 1000 });
  assert.deepEqual(result, { status: 'READY', service: 'swim-flow-nest-api', dependency: 'postgresql' });
  assert.deepEqual(requests.map(x => x.url), [
    EXPECTED_ORIGIN + '/health', EXPECTED_ORIGIN + '/health/ready',
  ]);
  for (const { options } of requests) {
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal);
    assert.equal(options.headers.Accept, 'application/json');
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.body, undefined);
  }
});

test('fails closed for 503, wrong service, malformed readiness and invalid origin', async () => {
  for (const options of [
    { readyStatus: 503 },
    { readyBody: { status: 'ready', service: 'wrong-api', dependency: 'postgresql' } },
    { readyBody: { status: 'ready', service: 'swim-flow-nest-api', dependency: 'mock' } },
    { livenessBody: { status: 'ready', service: 'swim-flow-nest-api' } },
  ]) {
    const { impl } = stubFetch(options);
    await assert.rejects(probeStagingReadiness({ fetchImpl: impl, timeoutMs: 1000 }));
  }
  const { impl, requests } = stubFetch();
  await assert.rejects(probeStagingReadiness({ fetchImpl: impl, origin: 'https://other.onrender.com' }));
  assert.equal(requests.length, 0);
});

test('manual workflow is read-only and cannot run on push/PR', () => {
  const w = readFileSync(resolve(__dirname, '..', '.github/workflows/render-staging-readiness.yml'), 'utf8');
  assert.match(w, /workflow_dispatch:/);
  assert.doesNotMatch(w, /\n  (push|pull_request|schedule|workflow_call):/);
  assert.match(w, /github\.ref == 'refs\/heads\/main'/);
  assert.match(w, /github\.repository == 'HenriqueTechPro\/swim-flow-api'/);
  assert.match(w, /node scripts\/render-staging-readiness\.cjs --probe/);
  assert.doesNotMatch(w, /\$\{\{\s*secrets\.|DATABASE_URL|DIRECT_URL|BLOB_READ_WRITE_TOKEN/);
  assert.doesNotMatch(w, /run:\s*[^\n]*(?:migrate|deploy|db push|start:prod)/i);
});
