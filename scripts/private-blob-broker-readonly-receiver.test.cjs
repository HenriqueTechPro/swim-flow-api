'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { createStagingReadOnlyProbe } = require('./private-blob-broker-auth-v1.cjs');
const {
  createStagingBrokerProbeReceiver, isStagingBrokerEnv,
} = require('./private-blob-broker-readonly-receiver.cjs');
const {
  createAtomicPostgresNonceClaim,
} = require('./private-blob-broker-postgres-nonce.cjs');

const KEY = randomBytes(32).toString('base64url');
const NOW = 1793567000000;
const PROJECT = 'prj_n2mFk76ZGhn5A8wnhpb7Asj8WKjz';
const env = Object.freeze({
  SWIMFLOW_BLOB_BROKER_READONLY_ENABLED: 'true',
  SWIMFLOW_BLOB_BROKER_PROJECT_ID: PROJECT,
  VERCEL_PROJECT_ID: PROJECT,
  VERCEL_ENV: 'preview',
  BLOB_STORE_ID: 'store_PJZzrdBiiVcRyLHj',
  VERCEL_OIDC_TOKEN: 'mocked-short-lived-oidc',
  SWIMFLOW_PRIVATE_BLOB_ENABLED: 'false',
  SWIMFLOW_BLOB_BROKER_SHARED_KEY: KEY,
});

function request(json, options = {}) {
  return new Request(
    'https://staging-broker.example.test/api/probe' + (options.query || ''),
    {
      method: options.method || 'POST',
      headers: {
        'content-type': options.contentType || 'application/json',
        ...options.headers,
      },
      body: options.method === 'GET'
        ? undefined
        : options.body === undefined ? JSON.stringify(json) : options.body,
    },
  );
}

function setup({ overrides = {}, claimNonce, head, now = () => NOW } = {}) {
  class BlobNotFoundError extends Error {}
  let claims = 0;
  let heads = 0;
  const receiver = createStagingBrokerProbeReceiver({
    env: { ...env, ...overrides },
    claimNonce: claimNonce || (async () => { claims++; return true; }),
    head: head || (async (pathname, opts) => {
      heads++;
      assert.match(pathname, /^__swimflow-broker-probe\/v1\/[0-9a-f-]{36}\.txt$/);
      assert.ok(opts.abortSignal);
      assert.deepEqual(Object.keys(opts), ['abortSignal']);
      throw new BlobNotFoundError('not found');
    }),
    BlobNotFoundError,
    now,
  });
  return { receiver, totals: () => ({ claims, heads }), BlobNotFoundError };
}

test('only authenticated, signed, unique synthetic HEAD reaches Blob SDK', async () => {
  const { receiver, totals } = setup();
  const response = await receiver(request(createStagingReadOnlyProbe(KEY, NOW)));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { code: 'synthetic-head-not-found' });
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.deepEqual(totals(), { claims: 1, heads: 1 });
});

test('block wrong Vercel project, production, smoke lab, mixed credentials and missing OIDC before reading body', async () => {
  const changes = [
    { SWIMFLOW_BLOB_BROKER_READONLY_ENABLED: 'false' },
    { SWIMFLOW_BLOB_BROKER_READONLY_ENABLED: undefined },
    { VERCEL_ENV: 'production' },
    { VERCEL_ENV: 'development' },
    { VERCEL_PROJECT_ID: undefined },
    { VERCEL_PROJECT_ID: 'prj_amGQuKcaOIuLUdlqMYK3ltZRYC43',
      SWIMFLOW_BLOB_BROKER_PROJECT_ID: 'prj_amGQuKcaOIuLUdlqMYK3ltZRYC43' },
    { VERCEL_PROJECT_ID: 'prj_GH6wd4vwTJb9sHkP8sGXSAUleE5P',
      SWIMFLOW_BLOB_BROKER_PROJECT_ID: 'prj_GH6wd4vwTJb9sHkP8sGXSAUleE5P' },
    // Even a self-consistent, unrelated project must fail closed:
    { VERCEL_PROJECT_ID: 'prj_ABCDEFGHIJKLMNOP1234',
      SWIMFLOW_BLOB_BROKER_PROJECT_ID: 'prj_ABCDEFGHIJKLMNOP1234' },
    { SWIMFLOW_BLOB_BROKER_PROJECT_ID: 'prj_OTHEROTHEROTHEROTHER' },
    { BLOB_STORE_ID: 'store_pAtHIpXAePc3zgXg' },
    { BLOB_STORE_ID: 'store_wrong_storage' },
    { BLOB_READ_WRITE_TOKEN: 'other-token' },
    { BLOB_SMOKE_STORE_ID: 'store_wrong' },
    { BLOB_SMOKE_READ_WRITE_TOKEN: 'other-token' },
    { VERCEL_OIDC_TOKEN: undefined },
    { VERCEL_BLOB_API_URL: 'https://wrong.example.test' },
    { NEXT_PUBLIC_VERCEL_BLOB_API_URL: 'https://wrong.example.test' },
    { SWIMFLOW_PRIVATE_BLOB_ENABLED: 'true' },
    { SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED: 'true' },
    { SWIMFLOW_R2_STORAGE_ENABLED: 'true' },
  ];
  for (const patch of changes) {
    assert.equal(isStagingBrokerEnv({ ...env, ...patch }), false);
    const { receiver, totals } = setup({ overrides: patch });
    const response = await receiver(request(createStagingReadOnlyProbe(KEY, NOW)));
    assert.equal(response.status, 503);
    assert.deepEqual(totals(), { claims: 0, heads: 0 });
  }
  const { receiver } = setup({ claimNonce: undefined, overrides: {
    SWIMFLOW_BLOB_BROKER_SHARED_KEY: undefined,
  } });
  assert.equal((await receiver(request({}))).status, 503);
});

test('method, route, query, browser-origin and content-type must match exactly', async () => {
  const { receiver, totals } = setup();
  const probe = createStagingReadOnlyProbe(KEY, NOW);
  const cases = [
    [new Request('https://staging-broker.example.test/api/probe', { method: 'GET' }), 405],
    [request(probe, { query: '?path=private/students' }), 404],
    [new Request('https://staging-broker.example.test/api/other', { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: '{}' }), 404],
    [request(probe, { headers: { Origin: 'https://untrusted.example' } }), 403],
    [request(probe, { contentType: 'text/plain' }), 415],
    [request(probe, { contentType: 'application/json; charset=utf-8' }), 415],
  ];
  for (const [input, status] of cases) {
    const response = await receiver(input);
    assert.equal(response.status, status);
  }
  assert.deepEqual(totals(), { claims: 0, heads: 0 });
});

test('oversized, empty, malformed UTF-8 and invalid JSON never claim a nonce', async () => {
  const { receiver, totals } = setup();
  const cases = [
    [request({}, { body: 'X'.repeat(1100) }), 413],
    [request({}, { body: '' }), 400],
    [request({}, { body: 'not json' }), 400],
    [request({}, { body: new Uint8Array([0xff, 0xfe]) }), 400],
    [request({}, { body: '{}', headers: { 'Content-Length': '9000' } }), 413],
  ];
  for (const [input, status] of cases) {
    assert.equal((await receiver(input)).status, status);
  }
  assert.deepEqual(totals(), { claims: 0, heads: 0 });
});

test('rejected signature, expired probe and forbidden student key cannot trigger HEAD', async () => {
  const { receiver, totals } = setup();
  const signed = createStagingReadOnlyProbe(KEY, NOW);
  const cases = [
    { ...signed, signature: 'A'.repeat(43) },
    { ...signed, operation: 'get' },
    { ...signed, pathname: 'private/students/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg' },
    { ...signed, audience: 'another-audience' },
    { ...signed, version: 2 },
  ];
  for (const item of cases) {
    assert.equal((await receiver(request(item))).status, 401);
  }
  const { receiver: expired } = setup({ now: () => NOW + 30001 });
  assert.equal((await expired(request(signed))).status, 401);
  assert.deepEqual(totals(), { claims: 0, heads: 0 });
});

test('durable atomic nonce must reject replays; error fails closed', async () => {
  const claimed = new Set();
  const { receiver } = setup({ claimNonce: async (key) => {
    if (claimed.has(key)) return false;
    claimed.add(key);
    return true;
  } });
  const signed = createStagingReadOnlyProbe(KEY, NOW);
  assert.equal((await receiver(request(signed))).status, 200);
  assert.equal((await receiver(request(signed))).status, 401);
  const { receiver: failing } = setup({ claimNonce: async () => {
    throw new Error('never-print-sensitive-database-connection-string');
  } });
  const response = await failing(request(createStagingReadOnlyProbe(KEY, NOW)));
  assert.equal(response.status, 401);
  assert.ok(!(await response.text()).includes('sensitive'));
});

test('unexpected Blob presence, network failure and malformed SDK response fail closed', async () => {
  const signed = createStagingReadOnlyProbe(KEY, NOW);
  assert.equal((await setup({ head: async () => ({ etag: 'secret' }) })
    .receiver(request(signed))).status, 409);
  assert.equal((await setup({ head: async () => null })
    .receiver(request(signed))).status, 502);
  const response = await setup({ head: async () => {
    throw new Error('secret-upstream-url');
  } }).receiver(request(signed));
  assert.equal(response.status, 502);
  assert.ok(!(await response.text()).includes('secret'));
});

test('real deployment is blocked when durable nonce claim is absent', async () => {
  const sender = createStagingReadOnlyProbe(KEY, NOW);
  const receiver = createStagingBrokerProbeReceiver({
    env, head: async () => { throw new Error('should-not-run'); },
    BlobNotFoundError: class BlobNotFoundError extends Error {},
    now: () => NOW,
  });
  assert.equal((await receiver(request(sender))).status, 503);
});

test('PostgreSQL nonce adapter uses one parameterized atomic insert, never SELECT then INSERT', async () => {
  const signed = createStagingReadOnlyProbe(KEY, NOW);
  const key = 'swim-flow-blob-staging-broker-v1:' + signed.nonce;
  const issuedAt = NOW + 31000;
  let count = 0;
  const claim = createAtomicPostgresNonceClaim(async (sql, params) => {
    count++;
    assert.match(sql, /^INSERT INTO private_blob_broker_nonce_claims /);
    assert.match(sql, /ON CONFLICT \(nonce_key\) DO NOTHING RETURNING nonce_key$/);
    assert.equal(sql.includes('SELECT'), false);
    assert.equal(sql.includes(key), false);
    assert.deepEqual(params, [key, new Date(issuedAt)]);
    return count === 1 ? { rowCount: 1, rows: [{ nonce_key: key }] }
      : { rowCount: 0, rows: [] };
  });
  assert.equal(await claim(key, issuedAt), true);
  assert.equal(await claim(key, issuedAt), false);
  assert.equal(count, 2);
});

test('PostgreSQL nonce adapter denies missing DB, malformed nonce, partial or spoofed result', async () => {
  assert.throws(() => createAtomicPostgresNonceClaim(null),
    /broker-nonce-durable-store-required/);
  let calls = 0;
  const claim = createAtomicPostgresNonceClaim(async () => {
    calls++;
    return { rowCount: 1, rows: [{ nonce_key: 'wrong' }] };
  });
  assert.equal(await claim('not-a-nonce', NOW), false);
  assert.equal(await claim('swim-flow-blob-staging-broker-v1:' + 'e'.repeat(36), NOW), false);
  assert.equal(calls, 0);
  const key = 'swim-flow-blob-staging-broker-v1:' + createStagingReadOnlyProbe(KEY, NOW).nonce;
  assert.equal(await claim(key, NOW), false);
  assert.equal(calls, 1);
  const failing = createAtomicPostgresNonceClaim(async () => {
    throw new Error('DB details');
  });
  await assert.rejects(failing(key, NOW), /DB details/);
});
