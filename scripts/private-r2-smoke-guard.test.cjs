'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertLiveSmokeEnvironment, normalizeOrigin, APPROVAL } =
  require('./private-r2-smoke-guard.cjs');

const valid = Object.freeze({
  SWIMFLOW_R2_SMOKE_APPROVAL: APPROVAL,
  R2_SMOKE_ENDPOINT: 'https://' + 'a'.repeat(32) + '.r2.cloudflarestorage.com',
  R2_SMOKE_BUCKET: 'swimflow-r2-smoke-ci-only',
  R2_SMOKE_ACCESS_KEY_ID: 'not-a-real-key-12345',
  R2_SMOKE_SECRET_ACCESS_KEY: 'not-a-real-secret-12345',
  R2_SMOKE_ORIGIN: 'https://swimflow-test.vercel.app',
  SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED: 'false',
});

test('manual smoke refuses implicit execution and live application flags', () => {
  assert.throws(() => assertLiveSmokeEnvironment(valid, []), /approval/);
  assert.throws(() => assertLiveSmokeEnvironment({
    ...valid, SWIMFLOW_R2_SMOKE_APPROVAL: '',
  }, ['--execute']), /approval/);
  assert.throws(() => assertLiveSmokeEnvironment({
    ...valid, NODE_ENV: 'production',
  }, ['--execute']), /approval/);
  assert.throws(() => assertLiveSmokeEnvironment({
    ...valid, SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED: 'true',
  }, ['--execute']), /must-stay-disabled/);
});

test('smoke never accepts production-like bucket names, arbitrary endpoints or secrets missing', () => {
  for (const bad of [
    { R2_SMOKE_BUCKET: 'swim-flow-private-media' },
    { R2_SMOKE_BUCKET: 'swimflow-r2-smoke-production' },
    { R2_SMOKE_BUCKET: 'swimflow-r2-smoke-prod' },
    { R2_SMOKE_BUCKET: 'swimflow-r2-smoke-prod-backup' },
    { R2_SMOKE_ENDPOINT: 'https://public.r2.dev' },
    { R2_SMOKE_ENDPOINT: 'http://' + 'a'.repeat(32) + '.r2.cloudflarestorage.com' },
    { R2_SMOKE_ENDPOINT: 'https://' + 'a'.repeat(32) + '.r2.cloudflarestorage.com/production' },
  ]) {
    assert.throws(() => assertLiveSmokeEnvironment({
      ...valid, ...bad,
    }, ['--execute']), /dedicated-bucket/);
  }
  assert.throws(() => assertLiveSmokeEnvironment({
    ...valid, R2_SMOKE_SECRET_ACCESS_KEY: '',
  }, ['--execute']), /credentials/);
});

test('CORS origin is exact and rejects secrets, paths, wildcard, non-HTTPS except localhost', () => {
  assert.equal(normalizeOrigin('https://swimflow-test.vercel.app'),
    'https://swimflow-test.vercel.app');
  assert.equal(normalizeOrigin('http://localhost:5173'),
    'http://localhost:5173');
  for (const origin of [
    '*',
    'http://swimflow-test.vercel.app',
    'https://swimflow-test.vercel.app/path',
    'https://swimflow-test.vercel.app?secret=1',
    'https://username:pass@swimflow-test.vercel.app',
    'https://swimflow-test.vercel.app/',
  ]) {
    assert.throws(() => normalizeOrigin(origin), /origin/);
  }
});

test('valid disposable configuration passes only with explicit opt-in', () => {
  const result = assertLiveSmokeEnvironment(valid, ['--execute']);
  assert.equal(result.bucket, valid.R2_SMOKE_BUCKET);
  assert.equal(result.endpoint, valid.R2_SMOKE_ENDPOINT);
  assert.equal(result.origin, valid.R2_SMOKE_ORIGIN);
});
