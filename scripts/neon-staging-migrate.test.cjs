'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  validateTarget, verifyFrozenBaseline, assertPostMigration,
  executeStagingMigration, STAGING, POST_MIGRATION_QUERY,
} = require('./neon-staging-migrate.cjs');

const env = Object.freeze({
  NEON_PROJECT_ID: STAGING.projectId,
  NEON_BRANCH_ID: STAGING.branchId,
  SWIMFLOW_NEON_STAGING_APPROVAL: STAGING.acknowledgement,
  DIRECT_URL: 'postgresql://sample:fictional@' + STAGING.directHost +
    '/swimflow?sslmode=require',
  DATABASE_URL: 'postgresql://sample:fictional@' + STAGING.pooledHost +
    '/swimflow?sslmode=require',
});

function fakeDeps(snapshot = {}) {
  const calls = [];
  return {
    calls,
    verifyFrozenBaseline: () => { calls.push('frozen-baseline'); },
    checkBaselineGenerated: () => { calls.push('generated-baseline'); },
    inspect: async () => {
      calls.push('inspect');
      return {
        candidateEmpty: true, userRelations: 0, userEnums: 0,
        hasPrismaMigrationTable: false, direct: 'connected',
        pooled: 'connected', ...snapshot,
      };
    },
    migrate: () => { calls.push('migrate'); },
    verify: async () => {
      calls.push('verify');
      return {
        application_tables: 31, application_enums: 24,
        applied_baseline: 1, total_migrations: 1,
      };
    },
    migrationStatus: () => { calls.push('migrate-status'); },
  };
}

test('pins project, branch, specific direct/pooled hosts, database and TLS', () => {
  assert.equal(validateTarget(env, ['--apply']), true);
  const bad = [
    [{ ...env, NEON_BRANCH_ID: 'br-wrong' }, /project and branch/],
    [{ ...env, NEON_PROJECT_ID: 'wrong' }, /project and branch/],
    [{ ...env, DIRECT_URL: env.DIRECT_URL.replace(STAGING.directHost, 'ep-other.us-east-1.aws.neon.tech') }, /(?:same Neon endpoint|connection host)/],
    [{ ...env, DATABASE_URL: env.DATABASE_URL.replace('swimflow?', 'different?') }, /same database/],
    [{ ...env, DATABASE_URL: env.DATABASE_URL.replace('sslmode=require', 'sslmode=disable') }, /TLS/],
    [{ ...env, SWIMFLOW_NEON_STAGING_APPROVAL: 'NO' }, /approval/],
  ];
  for (const [value, expected] of bad) {
    assert.throws(() => validateTarget(value, ['--apply']), expected);
  }
  assert.throws(() => validateTarget(env, []), /--apply/);
  assert.throws(() => validateTarget(env, ['--apply', '--force']), /--apply/);
});

test('checks exact reviewed migration bytes and inventory without Neon access', () => {
  assert.equal(verifyFrozenBaseline(), true);
});

test('dry-run unit test guarantees the order: baseline, read-only check, Prisma deploy, post checks', async () => {
  const deps = fakeDeps();
  assert.deepEqual(await executeStagingMigration(env, ['--apply'], deps), {
    applicationTables: 31, applicationEnums: 24, prismaMigrations: 1,
  });
  assert.deepEqual(deps.calls, [
    'frozen-baseline', 'generated-baseline',
    'inspect', 'migrate', 'verify', 'migrate-status',
  ]);
});

test('blocks writes if database is occupied, prior Prisma history exists or an endpoint fails', async () => {
  for (const state of [
    { candidateEmpty: false, userRelations: 1 },
    { candidateEmpty: false, userEnums: 1 },
    { hasPrismaMigrationTable: true },
    { direct: 'unavailable' },
    { pooled: 'unavailable' },
  ]) {
    const deps = fakeDeps(state);
    await assert.rejects(executeStagingMigration(env, ['--apply'], deps), /not verified empty/);
    assert.ok(!deps.calls.includes('migrate'), 'Must never write to occupied DB');
  }
});

test('no migration when immutable baseline check fails', async () => {
  const deps = fakeDeps();
  deps.verifyFrozenBaseline = () => { throw new Error('baseline mutated'); };
  await assert.rejects(executeStagingMigration(env, ['--apply'], deps), /baseline mutated/);
  assert.ok(!deps.calls.includes('migrate'));
});

test('failed post-deploy validation never reports success', async () => {
  const deps = fakeDeps();
  deps.verify = async () => ({ application_tables: 31, application_enums: 25,
    applied_baseline: 1, total_migrations: 1 });
  await assert.rejects(executeStagingMigration(env, ['--apply'], deps), /Unexpected post-migration/);
  assert.deepEqual(deps.calls.slice(0, 4), [
    'frozen-baseline', 'generated-baseline', 'inspect', 'migrate',
  ]);
});

test('post-deploy verification requires one completed baseline and expected schema', () => {
  assert.deepEqual(assertPostMigration({
    application_tables: 31, application_enums: 24,
    applied_baseline: 1, total_migrations: 1,
  }), { applicationTables: 31, applicationEnums: 24, prismaMigrations: 1 });
  for (const row of [
    null,
    { application_tables: 31, application_enums: 24, applied_baseline: 0, total_migrations: 1 },
    { application_tables: 31, application_enums: 24, applied_baseline: 1, total_migrations: 2 },
    { application_tables: 31, application_enums: 23, applied_baseline: 1, total_migrations: 1 },
  ]) assert.throws(() => assertPostMigration(row), /Unexpected post-migration/);
  assert.match(POST_MIGRATION_QUERY, /_prisma_migrations/);
  assert.match(POST_MIGRATION_QUERY.trim(), /^SELECT/i);
});
