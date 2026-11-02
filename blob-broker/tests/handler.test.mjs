import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { createBrokerHandler, isIsolatedNonceDatabase } from '../lib/handler.mjs';

const require = createRequire(import.meta.url);
const { createStagingReadOnlyProbe } = require('../lib/private-blob-broker-auth-v1.cjs');

const KEY = randomBytes(32).toString('base64url');
const NOW = 1793567000000;
const HOST = 'ep-broker-staging-pooler.us-east-1.aws.neon.tech';
const URL = 'postgresql://swimflow_blob_broker_nonce_rw:test-only-secret-not-real@' +
  HOST + ':5432/swimflow_blob_broker_nonce_staging?sslmode=require';

const PREVIEW = Object.freeze({
  SWIMFLOW_BLOB_BROKER_READONLY_ENABLED: 'true',
  SWIMFLOW_BLOB_BROKER_PROJECT_ID: 'prj_n2mFk76ZGhn5A8wnhpb7Asj8WKjz',
  VERCEL_PROJECT_ID: 'prj_n2mFk76ZGhn5A8wnhpb7Asj8WKjz',
  VERCEL_ORG_ID: 'team_ONfSvrgCkVLlDaKIeFuPlrEL',
  VERCEL_ENV: 'preview',
  VERCEL_OIDC_TOKEN: 'test-only-oidc',
  BLOB_STORE_ID: 'store_PJZzrdBiiVcRyLHj',
  SWIMFLOW_PRIVATE_BLOB_ENABLED: 'false',
  SWIMFLOW_BLOB_BROKER_SHARED_KEY: KEY,
  SWIMFLOW_BLOB_BROKER_NONCE_DB_HOST: HOST,
  SWIMFLOW_BLOB_BROKER_NONCE_DATABASE_URL: URL,
});

function probe(payload) {
  return new Request('https://broker.example.invalid/api/probe', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

test('cold project remains safely disabled with no token, DB or SDK import', async () => {
  let imports = 0;
  const h = createBrokerHandler({
    env: {},
    loadBlob: async () => { imports++; throw Error('must not import'); },
    createQuery: async () => { imports++; throw Error('must not connect'); },
  });
  const res = await h.fetch(probe({}));
  assert.equal(res.status, 503);
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await res.json(), { code: 'broker-disabled' });
  assert.equal(imports, 0);
});

test('only the exact Neon nonce database and dedicated role are allowed', () => {
  assert.equal(isIsolatedNonceDatabase(PREVIEW), true);
  for (const patch of [
    { SWIMFLOW_BLOB_BROKER_NONCE_DATABASE_URL: undefined },
    { SWIMFLOW_BLOB_BROKER_NONCE_DB_HOST: undefined },
    { DATABASE_URL: URL },
    { DIRECT_URL: URL },
    { SWIMFLOW_BLOB_BROKER_NONCE_DATABASE_URL: URL.replace('swimflow_blob_broker_nonce_rw', 'neondb_owner') },
    { SWIMFLOW_BLOB_BROKER_NONCE_DATABASE_URL: URL.replace('/swimflow_blob_broker_nonce_staging', '/swimflow') },
    { SWIMFLOW_BLOB_BROKER_NONCE_DATABASE_URL: URL.replace('?sslmode=require', '') },
    { SWIMFLOW_BLOB_BROKER_NONCE_DATABASE_URL: URL.replace('?sslmode=require', '?sslmode=disable') },
    { SWIMFLOW_BLOB_BROKER_NONCE_DATABASE_URL: URL.replace('?sslmode=require', '?sslmode=require&x=y') },
    { SWIMFLOW_BLOB_BROKER_NONCE_DATABASE_URL: URL.replace(HOST, 'ep-other.neon.tech') },
    { SWIMFLOW_BLOB_BROKER_NONCE_DATABASE_URL: URL.replace(HOST, '127.0.0.1') },
    { SWIMFLOW_BLOB_BROKER_NONCE_DB_HOST: 'attacker.example' },
  ]) assert.equal(isIsolatedNonceDatabase({ ...PREVIEW, ...patch }), false);
});

test('fail closed on wrong project, environment, Blob store or missing HMAC', async () => {
  for (const patch of [
    { SWIMFLOW_BLOB_BROKER_READONLY_ENABLED: 'false' },
    { VERCEL_ENV: 'production' },
    { VERCEL_PROJECT_ID: 'prj_otherprojectdifferent' },
    { VERCEL_ORG_ID: 'team_otherteamdifferent' },
    { BLOB_STORE_ID: 'store_pAtHIpXAePc3zgXg' },
    { VERCEL_OIDC_TOKEN: undefined },
    { BLOB_READ_WRITE_TOKEN: 'must-not-be-here' },
    { SWIMFLOW_BLOB_BROKER_SHARED_KEY: undefined },
  ]) {
    let calls = 0;
    const h = createBrokerHandler({
      env: { ...PREVIEW, ...patch },
      loadBlob: async () => { calls++; throw Error('must not import'); },
    });
    assert.equal((await h.fetch(probe({}))).status, 503);
    assert.equal(calls, 0);
  }
});

test('signed HEAD of synthetic key succeeds, concurrent replay fails via database nonce', async () => {
  const used = new Set();
  let dbCalls = 0;
  let headCalls = 0;
  class BlobNotFoundError extends Error {}
  const h = createBrokerHandler({
    env: PREVIEW, now: () => NOW,
    loadBlob: async () => ({
      BlobNotFoundError,
      head: async (pathname, options) => {
        headCalls++;
        assert.match(pathname, /^__swimflow-broker-probe\/v1\/[0-9a-f-]{36}\.txt$/);
        assert.deepEqual(Object.keys(options), ['abortSignal']);
        throw new BlobNotFoundError();
      },
    }),
    createQuery: async (connectionString) => {
      assert.equal(connectionString, URL);
      return async (sql, params) => {
        dbCalls++;
        assert.match(sql, /^INSERT INTO private_blob_broker_nonce_claims/);
        const key = params[0];
        if (used.has(key)) return { rowCount: 0, rows: [] };
        used.add(key);
        return { rowCount: 1, rows: [{ nonce_key: key }] };
      };
    },
  });

  const request = createStagingReadOnlyProbe(KEY, NOW);
  const a = await h.fetch(probe(request));
  assert.equal(a.status, 200);
  assert.deepEqual(await a.json(), { code: 'synthetic-head-not-found' });
  const b = await h.fetch(probe(request));
  assert.equal(b.status, 401);
  assert.equal(dbCalls, 2);
  assert.equal(headCalls, 1);
});

test('unauthenticated photo path never performs a private Blob HEAD', async () => {
  let headCalls = 0;
  const h = createBrokerHandler({
    env: PREVIEW, now: () => NOW,
    loadBlob: async () => ({
      BlobNotFoundError: class BlobNotFoundError extends Error {},
      head: async () => { headCalls++; return {}; },
    }),
    createQuery: async () => async () => { throw Error('no db claim for invalid path'); },
  });
  const request = createStagingReadOnlyProbe(KEY, NOW);
  const response = await h.fetch(probe({
    ...request, pathname: 'private/students/test/photo.png',
  }));
  assert.equal(response.status, 401);
  assert.equal(headCalls, 0);
});

test('dependency import failure returns generic 503 and never reveals secrets', async () => {
  const h = createBrokerHandler({
    env: PREVIEW,
    loadBlob: async () => { throw Error('private-provider-credentials'); },
  });
  const response = await h.fetch(probe(createStagingReadOnlyProbe(KEY, NOW)));
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes('private-provider-credentials'));
});
