'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  verifyVersionedMigrations, validateApplyTarget,
  assertBefore, assertAfter, execute, STAGING,
} = require('./neon-local-auth-staging.cjs');

const env = {
  NEON_PROJECT_ID: STAGING.projectId,
  NEON_BRANCH_ID: STAGING.branchId,
  SWIMFLOW_LOCAL_AUTH_STAGING_APPROVAL: STAGING.approval,
  DATABASE_URL: `postgresql://user:pass@${STAGING.pooledHost}/swimflow?sslmode=require&schema=public`,
  DIRECT_URL: `postgresql://user:pass@${STAGING.directHost}/swimflow?sslmode=require&schema=public`,
};

function before() {
  return { database_name: 'swimflow', application_tables: 31, migrations: 1,
    baseline_ok: 1, identities_present: 0, tokens_present: 0,
    profiles: 0, sessions: 0 };
}

function after() {
  return { database_name: 'swimflow', application_tables: 33, migrations: 2,
    local_migration_ok: 1, identity_rows: 0, token_rows: 0, local_constraints: 9 };
}

test('checks the two historical immutable migrations offline', () => {
  assert.equal(verifyVersionedMigrations(), true);
});

test('refuses production, missing consent, wrong project/branch, insecure or mixed connections', () => {
  assert.throws(() => validateApplyTarget(env, []), /apply/);
  assert.throws(() => validateApplyTarget({ ...env, SWIMFLOW_LOCAL_AUTH_STAGING_APPROVAL: '' }, ['--apply']), /approval/);
  assert.throws(() => validateApplyTarget({ ...env, NEON_BRANCH_ID: 'production' }, ['--apply']), /approval/);
  assert.throws(() => validateApplyTarget({ ...env, DIRECT_URL: env.DIRECT_URL.replace('sslmode=require', 'sslmode=disable') }, ['--apply']), /TLS/);
  assert.throws(() => validateApplyTarget({ ...env, DATABASE_URL: env.DATABASE_URL.replace('swimflow?', 'different?') }, ['--apply']), /database|endpoint|staging/i);
  assert.throws(() => validateApplyTarget({ ...env, DIRECT_URL: env.DIRECT_URL.replace('schema=public','schema=private') }, ['--apply']), /schema/);
  assert.equal(validateApplyTarget(env, ['--apply']), true);
});

test('only accepts a pristine staging baseline and exactly two completed migrations', () => {
  assert.equal(assertBefore(before()), true);
  for (const patch of [
    { migrations: 2 }, { application_tables: 32 }, { identities_present: 1 },
    { profiles: 1 }, { sessions: 1 }, { database_name: 'neondb' },
    { baseline_ok: 0 },
  ]) {
    assert.throws(() => assertBefore({ ...before(), ...patch }));
  }
  assert.equal(assertAfter(after()), true);
  for (const patch of [
    { application_tables: 31 }, { local_migration_ok: 0 },
    { identity_rows: 1 }, { token_rows: 1 }, { local_constraints: 8 },
    { migrations: 1 },
  ]) {
    assert.throws(() => assertAfter({ ...after(), ...patch }));
  }
});

test('check mode does not call any database action', async () => {
  const unexpected = () => { throw new Error('Never access database in offline check'); };
  const result = await execute({}, ['--check'], {
    inspectBefore: unexpected,
    migrate: unexpected,
    inspectAfter: unexpected,
    status: unexpected,
  });
  assert.deepEqual(result, { verifiedFiles: 2, wroteDatabase: false });
});

test('legacy apply refuses future migrations BEFORE querying or writing to staging', async () => {
  const calls = [];
  const unexpected = () => { calls.push('database'); throw new Error('must not run'); };
  await assert.rejects(
    () => execute(env, ['--apply'], {
      inspectBefore: unexpected,
      migrate: unexpected,
      inspectAfter: unexpected,
      status: unexpected,
    }),
    /Unexpected migration inventory/,
  );
  assert.deepEqual(calls, []);
});
