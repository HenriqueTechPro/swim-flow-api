'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { TARGET } = require('./neon-production-target.cjs');
const { APPROVAL, assertProductionBootstrapTarget } =
  require('./bootstrap-production-first-admin.cjs');

function valid() {
  return {
    NEON_PROJECT_ID: TARGET.projectId,
    NEON_BRANCH_ID: TARGET.branchId,
    SWIMFLOW_PRODUCTION_BOOTSTRAP_ADMIN_APPROVAL: APPROVAL,
    DATABASE_URL: 'postgresql://owner:secret@' + TARGET.pooledHost +
      '/swimflow?sslmode=require&channel_binding=require',
    DIRECT_URL: 'postgresql://owner:secret@' + TARGET.directHost +
      '/swimflow?sslmode=require&channel_binding=require',
  };
}

test('validates the fixed new Neon production destination with SSL', () => {
  const e = valid();
  assert.equal(assertProductionBootstrapTarget(e, ['--apply']), e.DIRECT_URL);
  assert.equal(assertProductionBootstrapTarget(e, ['--resend']), e.DIRECT_URL);
  assert.equal(assertProductionBootstrapTarget({
    ...e, DIRECT_URL: e.DIRECT_URL + '&schema=public',
  }, ['--apply']), e.DIRECT_URL + '&schema=public');
});

test('rejects accidental/no action and all staging destinations', () => {
  const e = valid();
  for (const args of [[], ['--check'], ['--apply', '--resend']]) {
    assert.throws(() => assertProductionBootstrapTarget(e, args));
  }
  for (const patch of [
    { NEON_PROJECT_ID: 'raspy-breeze-33258358' },
    { NEON_BRANCH_ID: 'br-gentle-wildflower-b7qrnd74' },
    { SWIMFLOW_PRODUCTION_BOOTSTRAP_ADMIN_APPROVAL: '' },
    { DIRECT_URL: e.DIRECT_URL.replace(TARGET.directHost, 'ep-old-lake-b7qha3a0.c-13.us-east-1.aws.neon.tech') },
    { DATABASE_URL: e.DATABASE_URL.replace(TARGET.pooledHost, 'ep-old-lake-b7qha3a0-pooler.c-13.us-east-1.aws.neon.tech') },
    { DIRECT_URL: e.DIRECT_URL.replace('sslmode=require', 'sslmode=disable') },
    { DIRECT_URL: e.DIRECT_URL.replace('/swimflow', '/neondb') },
    { DIRECT_URL: e.DIRECT_URL + '&schema=private' },
    { DIRECT_URL: e.DIRECT_URL.replace('owner:secret@', 'owner@') },
    { DATABASE_URL: e.DATABASE_URL.replace('owner:secret@', 'other:secret@') },
    { DATABASE_URL: e.DATABASE_URL.replace('owner:secret@', 'owner:other@') },
  ]) {
    assert.throws(() => assertProductionBootstrapTarget({...e, ...patch}, ['--apply']));
  }
});
