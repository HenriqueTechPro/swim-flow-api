'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { TARGET, EXPECTED_MIGRATIONS } = require('./neon-production-target.cjs');
const { APPROVAL } = require('./bootstrap-production-first-admin.cjs');
const {
  RETARGET_APPROVAL,
  assertRetargetTarget,
  retargetPendingAdministrator,
} = require('./retarget-production-pending-admin.cjs');

const newEmail = 'owner@resend-example.test';
const oldEmail = 'admin@example.test';
const fullName = 'Production Admin';

function validEnv() {
  return {
    NEON_PROJECT_ID: TARGET.projectId,
    NEON_BRANCH_ID: TARGET.branchId,
    SWIMFLOW_PRODUCTION_BOOTSTRAP_ADMIN_APPROVAL: APPROVAL,
    SWIMFLOW_PENDING_ADMIN_RETARGET_APPROVAL: RETARGET_APPROVAL,
    DATABASE_URL: 'postgresql://owner:secret@' + TARGET.pooledHost +
      '/swimflow?sslmode=require',
    DIRECT_URL: 'postgresql://owner:secret@' + TARGET.directHost +
      '/swimflow?sslmode=require',
    SWIMFLOW_BOOTSTRAP_ADMIN_EMAIL: newEmail,
    SWIMFLOW_BOOTSTRAP_ADMIN_NAME: fullName,
  };
}

function mockDatabase(overrides = {}) {
  const calls = [];
  const identity = {
    email: oldEmail,
    passwordHash: null,
    emailConfirmedAt: null,
    disabledAt: null,
    lastSignInAt: null,
    ...overrides.identity,
  };
  const tx = {
    $queryRaw: async (strings) => {
      const sql = String(strings[0]);
      calls.push({ sql });
      return sql.includes('migration_name')
        ? (overrides.migrations || EXPECTED_MIGRATIONS).map(
          (migration_name) => ({ migration_name }),
        )
        : [{ held: '1' }];
    },
    profile: {
      count: async () => overrides.profiles ?? 1,
      findFirst: async () => ({
        id: '11111111-1111-1111-1111-111111111111',
        fullName: overrides.fullName ?? fullName,
        localAuthIdentity: identity,
      }),
    },
    localAuthIdentity: {
      count: async () => overrides.identities ?? 1,
      updateMany: async (args) => {
        calls.push({ updateIdentity: args });
        return { count: overrides.updatedCount ?? 1 };
      },
    },
    authSession: { count: async () => overrides.sessions ?? 0 },
    localAuthActionToken: {
      count: async () => overrides.otherTokens ?? 0,
      updateMany: async (args) => {
        calls.push({ invalidateTokens: args });
        return { count: 1 };
      },
    },
  };
  return {
    prisma: { $transaction: async (fn) => fn(tx) },
    calls,
  };
}

test('retarget requires reviewed Neon production and separate explicit approval', () => {
  const good = validEnv();
  assert.equal(assertRetargetTarget(good, ['--retarget']).input.email, newEmail);
  for (const args of [[], ['--apply'], ['--resend'], ['--retarget', '--resend']]) {
    assert.throws(() => assertRetargetTarget(good, args));
  }
  for (const patch of [
    { SWIMFLOW_PENDING_ADMIN_RETARGET_APPROVAL: '' },
    { NEON_PROJECT_ID: 'raspy-breeze-33258358' },
    { NEON_BRANCH_ID: 'br-gentle-wildflower-b7qrnd74' },
    { DATABASE_URL: good.DATABASE_URL.replace('sslmode=require', 'sslmode=disable') },
    { SWIMFLOW_BOOTSTRAP_ADMIN_EMAIL: 'not-an-email' },
    { SWIMFLOW_BOOTSTRAP_ADMIN_NAME: '' },
  ]) {
    assert.throws(() => assertRetargetTarget({ ...good, ...patch }, ['--retarget']));
  }
});

test('only the sole never-activated admin is retargeted; invitation revoked', async () => {
  const { prisma, calls } = mockDatabase();
  assert.equal(await retargetPendingAdministrator(prisma, {
    email: newEmail, fullName,
  }), true);
  assert.equal(calls.filter((c) => c.updateIdentity).length, 1);
  assert.equal(calls.filter((c) => c.invalidateTokens).length, 1);
  assert.equal(calls.find((c) => c.updateIdentity).updateIdentity.data.email, newEmail);
  assert.equal(calls.find((c) => c.updateIdentity).updateIdentity.where.email, oldEmail);
  assert.equal(calls.find((c) => c.invalidateTokens).invalidateTokens.where.purpose, 'INVITATION');
  assert.ok(calls.filter((c) => c.sql).every((c) =>
    /SELECT/i.test(c.sql) && !/INSERT|UPDATE|DELETE|DROP|ALTER/i.test(c.sql),
  ));
});

test('rejects active identity, changed admin, unexpected sessions or tokens', async () => {
  for (const changes of [
    { profiles: 2 },
    { identities: 2 },
    { sessions: 1 },
    { fullName: 'Different Admin' },
    { identity: { email: newEmail } },
    { identity: { passwordHash: 'active' } },
    { identity: { emailConfirmedAt: new Date() } },
    { identity: { disabledAt: new Date() } },
    { identity: { lastSignInAt: new Date() } },
    { otherTokens: 1 },
    { updatedCount: 0 },
    { migrations: EXPECTED_MIGRATIONS.slice(0, -1) },
  ]) {
    const { prisma } = mockDatabase(changes);
    await assert.rejects(
      () => retargetPendingAdministrator(prisma, { email: newEmail, fullName }),
    );
  }
});

test('retarget implementation never uses the mail sender or logs addresses', () => {
  const { readFileSync } = require('node:fs');
  const { resolve } = require('node:path');
  const code = readFileSync(resolve(__dirname, './retarget-production-pending-admin.cjs'), 'utf8');
  assert.doesNotMatch(code, /sendInvitation\(/);
  assert.doesNotMatch(code, /console\.log\(/);
  assert.match(code, /pg_advisory_xact_lock\(2026102108::bigint\)/);
});
