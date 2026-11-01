'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  STAGING_STORE_ID, STAGING_STORE_NAME, APPROVAL,
  classify, assertRenderBlobStagingReadOnly,
} = require('./render-blob-staging-readonly-guard.cjs');
const { main, safeStatus } = require('./render-blob-staging-readonly.cjs');

const token = 'vercel_blob_rw_PJZzrdBiiVcRyLHj_synthetic-only-never-real';
const valid = Object.freeze({
  SWIMFLOW_ENVIRONMENT: 'staging',
  BLOB_STORE_ID: STAGING_STORE_ID,
  BLOB_RENDER_STAGING_STORE_NAME: STAGING_STORE_NAME,
  BLOB_READ_WRITE_TOKEN: token,
  BLOB_RENDER_STAGING_APPROVAL: APPROVAL,
  SWIMFLOW_PRIVATE_BLOB_ENABLED: 'false',
  SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED: 'false',
  SWIMFLOW_R2_STORAGE_ENABLED: 'false',
  NODE_ENV: 'test',
});

test('real private media remains OFF; valid synthetic configuration is only probe-ready', () => {
  assert.equal(classify(valid), 'ready-for-manual-readonly-probe');
  assert.deepEqual(assertRenderBlobStagingReadOnly(valid, ['--execute']),
    { storeId: STAGING_STORE_ID, token });
  assert.equal(classify({ ...valid, BLOB_READ_WRITE_TOKEN: undefined }),
    'static-rw-credential-not-configured');
});

test('refuses production, main, lab and other Blob stores before SDK import', () => {
  for (const patch of [
    { SWIMFLOW_ENVIRONMENT: 'production' },
    { SWIMFLOW_ENVIRONMENT: 'development' },
    { BLOB_STORE_ID: 'store_pAtHIpXAePc3zgXg' },
    { BLOB_STORE_ID: 'store_SdzpYKLzZL6WPLHh' },
    { BLOB_RENDER_STAGING_STORE_NAME: 'swim-flow-private-media' },
  ]) {
    assert.equal(classify({ ...valid, ...patch }), 'identity-not-staging');
    assert.throws(
      () => assertRenderBlobStagingReadOnly({ ...valid, ...patch }, ['--execute']),
      /render-blob-identity-not-staging/,
    );
  }
});

test('rejects private media flags, accidental lab OIDC and blob endpoint overrides', () => {
  for (const patch of [
    { SWIMFLOW_PRIVATE_BLOB_ENABLED: 'true' },
    { SWIMFLOW_PRIVATE_BLOB_ENABLED: undefined },
    { SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED: 'true' },
    { SWIMFLOW_R2_STORAGE_ENABLED: 'true' },
  ]) assert.equal(classify({ ...valid, ...patch }), 'private-media-must-remain-disabled');
  for (const patch of [
    { VERCEL_OIDC_TOKEN: 'token-wrong-environment' },
    { BLOB_SMOKE_READ_WRITE_TOKEN: 'wrong' },
    { BLOB_SMOKE_STORE_ID: 'store_lab' },
    { VERCEL_BLOB_API_URL: 'https://wrong.invalid' },
    { NEXT_PUBLIC_VERCEL_BLOB_API_URL: 'https://wrong.invalid' },
  ]) assert.equal(classify({ ...valid, ...patch }), 'oidc-or-disposable-credentials-forbidden');
});

test('rejects absent, malformed, whitespace-polluted or other-store RW tokens', () => {
  for (const value of [
    '', undefined, 'eyJhbGciOiJIUzI1NiJ9.eyJuIjoic3RhZ2luZyJ9.signature',
    'store_PJZzrdBiiVcRyLHj',
    'vercel_blob_rw_PJZzrdBiiVcRyLHj_tiny',
    token + '\n', ' ' + token,
  ]) {
    assert.notEqual(classify({ ...valid, BLOB_READ_WRITE_TOKEN: value }),
      'ready-for-manual-readonly-probe');
  }
  for (const value of [
    'vercel_blob_rw_pAtHIpXAePc3zgXg_other-smoke-token-placeholder',
    'vercel_blob_rw_SdzpYKLzZL6WPLHh_production-secret-placeholder',
  ]) assert.equal(classify({ ...valid, BLOB_READ_WRITE_TOKEN: value }),
    'static-rw-credential-wrong-store');
});

test('requires one exact manual approval and refuses production process', () => {
  for (const args of [[], ['--check'], ['--execute', '--dangerous']]) {
    assert.throws(() => assertRenderBlobStagingReadOnly(valid, args),
      /render-blob-readonly-manual-approval-required/);
  }
  for (const patch of [
    { BLOB_RENDER_STAGING_APPROVAL: '' },
    { NODE_ENV: 'production' },
    { VERCEL_ENV: 'production' },
  ]) assert.throws(() =>
    assertRenderBlobStagingReadOnly({ ...valid, ...patch }, ['--execute']),
  /manual-approval/);
});

test('HEAD probe is synthetic and read-only; no student paths or bytes exposed', async () => {
  class BlobNotFoundError extends Error {}
  let calls = 0;
  const sdk = {
    BlobNotFoundError,
    head: async (key, options) => {
      calls++;
      assert.match(key, /^private\/profiles\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.png$/);
      assert.equal(options.token, token);
      assert.ok(options.abortSignal);
      throw new BlobNotFoundError('not found');
    },
  };
  assert.equal(await main(['--execute'], valid, sdk), 0);
  assert.equal(calls, 1);
});

test('rejects unexpected HEAD object and unknown network failures', async () => {
  class BlobNotFoundError extends Error {}
  await assert.rejects(main(['--execute'], valid, {
    BlobNotFoundError, head: async () => ({ etag: 'not-empty' }),
  }), /render-blob-synthetic-key-unexpectedly-found/);
  const secret = 'VERRRR-PRIVATE-BLOB-STAGING-SECRET';
  await assert.rejects(main(['--execute'], valid, {
    BlobNotFoundError, head: async () => { throw new Error(secret); },
  }), /render-blob-readonly-sdk-or-network-error/);
  assert.equal(safeStatus({ statusCode: 403, message: secret }),
    'render-blob-readonly-http-403');
  assert.equal(safeStatus({ message: secret }),
    'render-blob-readonly-sdk-or-network-error');
});

test('offline readiness reports blocked state without SDK imports', async () => {
  const code = await main(['--check'], { ...valid, BLOB_READ_WRITE_TOKEN: undefined });
  assert.equal(code, 2);
});
