'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { assertPrivateBlobSmokeEnvironment, APPROVAL } =
  require('./private-blob-smoke-guard.cjs');

const valid = Object.freeze({
  BLOB_SMOKE_APPROVAL: APPROVAL,
  NODE_ENV: 'test',
  BLOB_SMOKE_STORE_NAME: 'swim-flow-blob-smoke-ci-only',
  BLOB_SMOKE_STORE_ID: 'store_abcdefgh12345678',
  BLOB_SMOKE_READ_WRITE_TOKEN:
    'vercel_blob_rw_abcdefgh12345678_synthetic-placeholder-for-test',
  SWIMFLOW_PRIVATE_BLOB_ENABLED: 'false',
});

test('explicit manual approval is required before loading any SDK', () => {
  for (const args of [[], ['anything'], ['--execute', '--unsafe']]) {
    assert.throws(() => assertPrivateBlobSmokeEnvironment(valid, args), /approval/);
  }
  assert.throws(() => assertPrivateBlobSmokeEnvironment({
    ...valid, BLOB_SMOKE_APPROVAL: 'yes',
  }, ['--execute']), /approval/);
  assert.throws(() => assertPrivateBlobSmokeEnvironment({
    ...valid, NODE_ENV: 'production',
  }, ['--execute']), /approval/);
});

test('refuses main store even if supplied token matches and approval is correct', () => {
  assert.throws(() => assertPrivateBlobSmokeEnvironment({
    ...valid,
    BLOB_SMOKE_STORE_ID: 'store_SdzpYKLzZL6WPLHh',
    BLOB_SMOKE_READ_WRITE_TOKEN:
      'vercel_blob_rw_SdzpYKLzZL6WPLHh_synthetic-placeholder-for-test',
  }, ['--execute']), /disposable-store/);
  for (const name of ['swim-flow-private-media', 'swim-flow-blob-smoke-prod',
    'swim-flow-blob-smoke-main', 'swim-flow-blob-smoke-live']) {
    assert.throws(() => assertPrivateBlobSmokeEnvironment({
      ...valid, BLOB_SMOKE_STORE_NAME: name,
    }, ['--execute']), /disposable-store/);
  }
});

test('rejects mismatched token, malformed credentials, or accidental production env', () => {
  for (const patch of [
    { BLOB_SMOKE_READ_WRITE_TOKEN: '' },
    { BLOB_SMOKE_STORE_ID: 'store_zzz123456789' },
    { BLOB_SMOKE_READ_WRITE_TOKEN: 'vercel_blob_rw_wrong000000000000_secret-more-than-16-chars' },
    { BLOB_READ_WRITE_TOKEN: 'accidental-main-token' },
    { VERCEL_OIDC_TOKEN: 'autoinjected' },
    { VERCEL_BLOB_API_URL: 'https://evil.example.com' },
    { SWIMFLOW_PRIVATE_BLOB_ENABLED: 'true' },
    { SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED: 'true' },
  ]) {
    assert.throws(() => assertPrivateBlobSmokeEnvironment({
      ...valid, ...patch,
    }, ['--execute']), /blob-smoke-/);
  }
});

test('accepts only isolated test environment with matching token store ID', () => {
  const result = assertPrivateBlobSmokeEnvironment(valid, ['--execute']);
  assert.equal(result.storeId, valid.BLOB_SMOKE_STORE_ID);
  assert.equal(result.token, valid.BLOB_SMOKE_READ_WRITE_TOKEN);
});
