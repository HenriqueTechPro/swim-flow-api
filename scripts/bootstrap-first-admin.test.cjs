'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, openSync, closeSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const {
  STAGING, assertStagingTarget, validateAdminInput, readPasswordFromStdin, bootstrapFirstAdmin,
} = require('./bootstrap-first-admin.cjs');

const env = () => ({
  SWIMFLOW_BOOTSTRAP_ADMIN_APPROVAL: STAGING.approval,
  NEON_PROJECT_ID: STAGING.projectId,
  NEON_BRANCH_ID: STAGING.branchId,
  DIRECT_URL: 'postgresql://owner:secret@' + STAGING.directHost + '/swimflow?sslmode=require',
  DATABASE_URL: 'postgresql://owner:secret@' + STAGING.pooledHost + '/swimflow?sslmode=require',
});
const input = () => ({
  email: ' ADMIN@EXAMPLE.INVALID ', fullName: ' Site Administrator ',
  password: 'unique-admin-password-2026',
});
function fakeDb({ profiles = 0, identities = 0, sessions = 0, migration = true } = {}) {
  const calls = [];
  const tx = {
    $queryRaw: async (parts) => {
      calls.push('sql');
      return String(parts[0]).includes('pg_advisory_xact_lock')
        ? [{ held: '' }]
        : migration ? [{ migration_name: '20261021000000_local_auth_identity_foundation' }] : [];
    },
    profile: {
      count: async () => profiles,
      create: async ({ data }) => {
        calls.push('created');
        assert.equal(data.role, 'admin');
        assert.equal(data.fullName, 'Site Administrator');
        assert.equal(data.localAuthIdentity.create.email, 'admin@example.invalid');
        assert.equal(data.localAuthIdentity.create.passwordHash, 'HASHED');
        assert.ok(data.localAuthIdentity.create.emailConfirmedAt instanceof Date);
        return { id: data.id };
      },
    },
    localAuthIdentity: { count: async () => identities },
    authSession: { count: async () => sessions },
  };
  return { calls, $transaction: async (fn, opts) => {
    assert.equal(opts.isolationLevel, 'ReadCommitted');
    return fn(tx);
  }};
}

test('fail closed unless specifically approved staging endpoints and --apply', () => {
  assert.equal(assertStagingTarget(env(), ['--apply']), env().DIRECT_URL);
  assert.throws(() => assertStagingTarget(env(), []));
  for (const patch of [
    { SWIMFLOW_BOOTSTRAP_ADMIN_APPROVAL: '' },
    { NEON_PROJECT_ID: 'wrong-project' },
    { NEON_BRANCH_ID: 'wrong-branch' },
    { DIRECT_URL: 'postgresql://owner:secret@prod.neon.tech/swimflow' },
    { DATABASE_URL: 'postgresql://owner:secret@prod.neon.tech/swimflow' },
    { DIRECT_URL: 'postgresql://owner:secret@' + STAGING.directHost + '/production' },
    { DIRECT_URL: 'postgresql://owner@' + STAGING.directHost + '/swimflow' },
  ]) {
    assert.throws(() => assertStagingTarget({ ...env(), ...patch }, ['--apply']));
  }
});

test('canonical email/name, prevent invalid passwords and hidden newlines', () => {
  const result = validateAdminInput(input());
  assert.equal(result.email, 'admin@example.invalid');
  assert.equal(result.fullName, 'Site Administrator');
  for (const pwd of ['short', 'x'.repeat(73), 'á'.repeat(37), 'line\nother'])
    assert.throws(() => validateAdminInput({ ...input(), password: pwd }));
  assert.throws(() => validateAdminInput({ ...input(), email: 'not-an-email' }));
});

test('reads a piped password without argv or secret environment variables', () => {
  const dir = mkdtempSync(join(tmpdir(), 'swimflow-bootstrap-'));
  const path = join(dir, 'password');
  try {
    writeFileSync(path, 'piped-secret-password\n', { mode: 0o600 });
    const fd = openSync(path, 'r');
    try {
      assert.equal(readPasswordFromStdin(fd), 'piped-secret-password');
    } finally {
      closeSync(fd);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('creates exactly one linked admin after migration under transaction lock', async () => {
  const db = fakeDb();
  const output = await bootstrapFirstAdmin(db, input(), {
    hashPassword: async (pwd) => {
      assert.equal(pwd, input().password);
      return 'HASHED';
    },
    generateId: () => '11111111-1111-4111-8111-111111111111',
  });
  assert.equal(output.email, 'admin@example.invalid');
  assert.deepEqual(db.calls, ['sql', 'sql', 'created']);
});

test('no admin is created if migration is missing or existing users/sessions are present', async () => {
  for (const setting of [{ migration: false }, { profiles: 1 }, { identities: 1 }, { sessions: 1 }]) {
    const db = fakeDb(setting);
    await assert.rejects(() => bootstrapFirstAdmin(db, input(), { hashPassword: async () => 'HASHED' }));
    assert.ok(!db.calls.includes('created'));
  }
});
