'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assertDisposableOidcSmoke, LAB_PROJECT_ID, LAB_TEAM_ID,
  LAB_STORE_ID, APPROVAL,
} = require('./private-blob-oidc-smoke-guard.cjs');
const { requirePrivateUrl } = require('./verify-private-blob-oidc-live.cjs');

const link = { projectId: LAB_PROJECT_ID, orgId: LAB_TEAM_ID };
const env = {
  BLOB_OIDC_SMOKE_APPROVAL: APPROVAL,
  BLOB_STORE_ID: LAB_STORE_ID,
  VERCEL_OIDC_TOKEN: 'header'.repeat(5) + '.' +
    'payload'.repeat(6) + '.' + 'signature'.repeat(5),
  VERCEL_ENV: 'preview',
};

test('disposable OIDC guard has no side effects and never returns credentials', () => {
  assert.deepEqual(assertDisposableOidcSmoke(env, ['--execute'], link),
    { storeId: LAB_STORE_ID });
});

test('requires exact explicit approval, one argument and nonproduction env', () => {
  for (const args of [[], ['--apply'], ['--execute', '--more']]) {
    assert.throws(() => assertDisposableOidcSmoke(env, args, link),
      /blob-oidc-manual-approval-required/);
  }
  for (const patch of [
    { BLOB_OIDC_SMOKE_APPROVAL: 'yes' },
    { NODE_ENV: 'production' },
    { VERCEL_ENV: 'production' },
  ]) {
    assert.throws(() => assertDisposableOidcSmoke({ ...env, ...patch },
      ['--execute'], link), /manual-approval/);
  }
});

test('refuses any other linked project or team, even with disposable store', () => {
  for (const wrongLink of [
    null, {}, { ...link, projectId: 'prj_another' },
    { ...link, orgId: 'team_another' },
  ]) {
    assert.throws(() => assertDisposableOidcSmoke(env, ['--execute'], wrongLink),
      /lab-project-link-required/);
  }
  for (const patch of [
    { VERCEL_PROJECT_ID: 'prj_prod' },
    { VERCEL_ORG_ID: 'team_prod' },
  ]) {
    assert.throws(() => assertDisposableOidcSmoke({ ...env, ...patch },
      ['--execute'], link), /lab-project-link-required/);
  }
});

test('refuses the staging store and any alternate Blob store', () => {
  for (const otherId of [
    '', 'store_PJZzrdBiiVcRyLHj', 'store_SdzpYKLzZL6WPLHh',
    'store_not_real', 'pAtHIpXAePc3zgXg',
  ]) {
    assert.throws(() => assertDisposableOidcSmoke({
      ...env, BLOB_STORE_ID: otherId,
    }, ['--execute'], link), /disposable-store-id-required/);
  }
});

test('refuses missing OIDC or static/private storage overrides', () => {
  for (const token of ['', undefined, 'some-token', 'a.b.c']) {
    assert.throws(() => assertDisposableOidcSmoke({
      ...env, VERCEL_OIDC_TOKEN: token,
    }, ['--execute'], link), /project-token-missing-or-invalid/);
  }
  for (const patch of [
    { BLOB_READ_WRITE_TOKEN: 'some-old-token' },
    { BLOB_SMOKE_READ_WRITE_TOKEN: 'some-old-token' },
    { VERCEL_BLOB_API_URL: 'https://unsafe.invalid' },
    { NEXT_PUBLIC_VERCEL_BLOB_API_URL: 'https://unsafe.invalid' },
    { SWIMFLOW_PRIVATE_BLOB_ENABLED: 'true' },
    { SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED: 'true' },
    { SWIMFLOW_R2_STORAGE_ENABLED: 'true' },
  ]) {
    assert.throws(() => assertDisposableOidcSmoke({
      ...env, ...patch,
    }, ['--execute'], link), /production-storage-or-overrides-forbidden/);
  }
});

test('private URL must be HTTPS, exact lab host and no query or redirect', () => {
  const key = 'private/profiles/a/b.png';
  const host = LAB_STORE_ID.slice('store_'.length).toLowerCase() +
    '.private.blob.vercel-storage.com';
  const url = 'https://' + host + '/' + key;
  assert.doesNotThrow(() => requirePrivateUrl(url, key));
  for (const invalid of [
    'http://' + host + '/' + key,
    'https://' + host.replace('.private.', '.public.') + '/' + key,
    'https://another.private.blob.vercel-storage.com/' + key,
    url + '?download=1', url + '#fragment',
    url + '/other',
  ]) assert.throws(() => requirePrivateUrl(invalid, key),
    /blob-oidc-private-host-or-path-mismatch/);
});
