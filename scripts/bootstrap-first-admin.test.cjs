'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const {
  STAGING,
  assertStagingTarget,
  validateAdminInput,
  bootstrapFirstAdmin,
  provisionFirstAdminInvitation,
} = require('./bootstrap-first-admin.cjs');

const env = () => ({
  SWIMFLOW_BOOTSTRAP_ADMIN_APPROVAL: STAGING.approval,
  NEON_PROJECT_ID: STAGING.projectId,
  NEON_BRANCH_ID: STAGING.branchId,
  DIRECT_URL: 'postgresql://owner:secret@' + STAGING.directHost +
    '/swimflow?sslmode=require&schema=public',
  DATABASE_URL: 'postgresql://owner:secret@' + STAGING.pooledHost +
    '/swimflow?sslmode=require&schema=public',
});
const admin = () => ({
  email: ' ADMIN@EXAMPLE.INVALID ',
  fullName: ' Staging Administrator ',
});
const token = 'x'.repeat(43);
const digest = createHash('sha256').update(token).digest('hex');

function fakeDb({ profiles = 0, identities = 0, sessions = 0, migration = true,
  identity = null } = {}) {
  const calls = [];
  const tx = {
    $queryRaw: async (parts) => {
      calls.push('sql');
      return String(parts[0]).includes('pg_advisory_xact_lock')
        ? [{ held: '' }]
        : migration
          ? [{ migration_name: '20261021000000_local_auth_identity_foundation' }]
          : [];
    },
    profile: {
      count: async () => profiles,
      findFirst: async () => identity,
      create: async ({ data }) => {
        calls.push('created');
        assert.equal(data.role, 'admin');
        assert.equal(data.fullName, 'Staging Administrator');
        assert.equal(data.localAuthIdentity.create.email, 'admin@example.invalid');
        assert.equal(data.localAuthIdentity.create.passwordHash, null);
        assert.equal(data.localAuthIdentity.create.emailConfirmedAt, null);
        assert.equal(
          data.localAuthIdentity.create.actionTokens.create.tokenHash,
          digest,
        );
        assert.equal(
          data.localAuthIdentity.create.actionTokens.create.purpose,
          'INVITATION',
        );
        const expiry = data.localAuthIdentity.create.actionTokens.create.expiresAt;
        assert.ok(expiry instanceof Date);
        assert.ok(expiry.getTime() > Date.now());
        assert.ok(!JSON.stringify(data).includes(token));
        return { id: data.id };
      },
    },
    localAuthIdentity: { count: async () => identities },
    authSession: { count: async () => sessions },
    localAuthActionToken: {
      updateMany: async ({ where, data }) => {
        calls.push('revoke-token');
        assert.deepEqual(where, {
          userId: '11111111-1111-4111-8111-111111111111',
          purpose: 'INVITATION',
          usedAt: null,
        });
        assert.ok(data.usedAt instanceof Date);
        return { count: 1 };
      },
      create: async ({ data }) => {
        calls.push('reissue');
        assert.equal(data.tokenHash, digest);
        assert.equal(data.purpose, 'INVITATION');
        assert.ok(data.expiresAt instanceof Date);
      },
    },
  };
  return {
    calls,
    $transaction: async (fn, opts) => {
      assert.equal(opts.isolationLevel, 'ReadCommitted');
      return fn(tx);
    },
  };
}

test('never accepts ambiguous staging target, TLS downgrade or non-public schema', () => {
  assert.equal(assertStagingTarget(env(), ['--apply']), env().DIRECT_URL);
  assert.equal(assertStagingTarget(env(), ['--resend']), env().DIRECT_URL);
  for (const args of [[], ['--dry-run'], ['--apply', '--resend']]) {
    assert.throws(() => assertStagingTarget(env(), args));
  }
  for (const patch of [
    { SWIMFLOW_BOOTSTRAP_ADMIN_APPROVAL: '' },
    { NEON_PROJECT_ID: 'wrong-project' },
    { NEON_BRANCH_ID: 'br-wrong' },
    { DIRECT_URL: 'postgresql://owner:secret@prod.neon.tech/swimflow' },
    { DATABASE_URL: 'postgresql://owner:secret@prod.neon.tech/swimflow' },
    { DIRECT_URL: env().DIRECT_URL.replace('sslmode=require', 'sslmode=disable') },
    { DATABASE_URL: env().DATABASE_URL.replace('schema=public', 'schema=other') },
    { DIRECT_URL: env().DIRECT_URL.replace('/swimflow?', '/production?') },
    { DIRECT_URL: env().DIRECT_URL.replace('owner:secret@', 'owner@') },
  ]) {
    assert.throws(() => assertStagingTarget({ ...env(), ...patch }, ['--apply']));
  }
});

test('validates email/name but rejects legacy bootstrap passwords', () => {
  assert.deepEqual(validateAdminInput(admin()), {
    email: 'admin@example.invalid',
    fullName: 'Staging Administrator',
  });
  for (const patch of [
    { email: 'not-an-email' },
    { fullName: 'x' },
    { fullName: 'x'.repeat(161) },
    { password: 'a-reused-bootstrap-password' },
  ]) {
    assert.throws(() => validateAdminInput({ ...admin(), ...patch }));
  }
});

test('creates only a pending admin with a hashed single-use invitation', async () => {
  const db = fakeDb();
  const created = await bootstrapFirstAdmin(db, admin(), {
    generateId: () => '11111111-1111-4111-8111-111111111111',
    generateToken: () => token,
  });
  assert.equal(created.email, 'admin@example.invalid');
  assert.equal(created.token, token);
  assert.equal(created.resent, false);
  assert.deepEqual(db.calls, ['sql', 'sql', 'created']);
});

test('never provisions on existing data or unapplied migration', async () => {
  for (const state of [
    { profiles: 1 },
    { identities: 1 },
    { sessions: 1 },
    { migration: false },
  ]) {
    const db = fakeDb(state);
    await assert.rejects(() =>
      bootstrapFirstAdmin(db, admin(), { generateToken: () => token }),
    );
    assert.ok(!db.calls.includes('created'));
  }
});

test('reissue requires exactly the same pending administrator and invalidates old tokens', async () => {
  const profile = {
    id: '11111111-1111-4111-8111-111111111111',
    role: 'admin',
    fullName: 'Staging Administrator',
    localAuthIdentity: {
      email: 'admin@example.invalid',
      disabledAt: null,
      emailConfirmedAt: null,
      passwordHash: null,
    },
  };
  const db = fakeDb({ profiles: 1, identities: 1, identity: profile });
  const result = await bootstrapFirstAdmin(db, admin(), {
    resend: true, generateToken: () => token,
  });
  assert.equal(result.id, profile.id);
  assert.equal(result.resent, true);
  assert.deepEqual(db.calls, ['sql', 'sql', 'revoke-token', 'reissue']);

  for (const patch of [
    { fullName: 'Changed Admin' },
    { localAuthIdentity: { ...profile.localAuthIdentity, emailConfirmedAt: new Date() } },
    { localAuthIdentity: { ...profile.localAuthIdentity, passwordHash: 'hash' } },
    { localAuthIdentity: { ...profile.localAuthIdentity, disabledAt: new Date() } },
    { localAuthIdentity: null },
  ]) {
    const rejected = fakeDb({
      profiles: 1,
      identities: 1,
      identity: { ...profile, ...patch },
    });
    await assert.rejects(() => bootstrapFirstAdmin(rejected, admin(), {
      resend: true, generateToken: () => token,
    }));
    assert.ok(!rejected.calls.includes('reissue'));
  }
  await assert.rejects(() => bootstrapFirstAdmin(
    fakeDb(), admin(), { resend: true, generateToken: () => token },
  ));
});

test('refuses database writes if mail is not configured', async () => {
  const db = fakeDb();
  const mail = {
    assertReady() { throw new Error('Mail not ready'); },
    async sendInvitation() { throw new Error('Must not send'); },
  };
  await assert.rejects(() => provisionFirstAdminInvitation(db, mail, admin()));
  assert.deepEqual(db.calls, []);
});

test('sends token only to the mailer, not through the CLI return value', async () => {
  const db = fakeDb();
  const mails = [];
  const mail = {
    assertReady() {},
    async sendInvitation(message) { mails.push(message); },
  };
  const result = await provisionFirstAdminInvitation(db, mail, admin(), {
    generateId: () => '11111111-1111-4111-8111-111111111111',
    generateToken: () => token,
  });
  assert.equal(mails.length, 1);
  assert.equal(mails[0].token, token);
  assert.equal(mails[0].to, 'admin@example.invalid');
  assert.equal(Object.hasOwn(result, 'token'), false);
  assert.ok(!JSON.stringify(result).includes(token));
  assert.equal(result.resent, false);
});
