'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { STAGING, BASELINE, PRIVATE_MEDIA, fileChecksum } =
  require('./private-media-staging-migrate.cjs');
const {
  assertAuditTarget, classifySnapshot, audit, execute,
} = require('./private-media-staging-audit.cjs');

function validEnv() {
  return {
    NODE_ENV: 'test',
    NEON_PROJECT_ID: STAGING.projectId,
    NEON_BRANCH_ID: STAGING.branchId,
    SWIMFLOW_PRIVATE_BLOB_ENABLED: 'false',
    SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED: 'false',
    SWIMFLOW_R2_STORAGE_ENABLED: 'false',
    GITHUB_REPOSITORY: 'HenriqueTechPro/swim-flow-api',
    GITHUB_REF: 'refs/heads/main',
    DATABASE_URL: 'postgresql://test:synthetic@' + STAGING.pooledHost +
      '/swimflow?sslmode=require&schema=public',
    DIRECT_URL: 'postgresql://test:synthetic@' + STAGING.directHost +
      '/swimflow?sslmode=require&schema=public',
  };
}
function snapshot(ready) {
  const names = ready ? [...BASELINE, ...PRIVATE_MEDIA] : BASELINE;
  return {
    schema: {
      database_name: 'swimflow',
      media_objects: ready, active_bindings: ready, local_auth: true,
      students: true, teachers: true, parents: true,
    },
    history: names.map(migration_name => ({
      migration_name, checksum: fileChecksum(migration_name), applied: true,
    })),
  };
}
test('staging pending and ready status checks exactly match reviewed 7-file history', () => {
  assert.equal(classifySnapshot(snapshot(false)), 'PENDING');
  assert.equal(classifySnapshot(snapshot(true)), 'READY');
  for (const s of [
    { ...snapshot(false), schema: { ...snapshot(false).schema, media_objects: true } },
    { ...snapshot(true), history: snapshot(true).history.slice(0, 6) },
    { ...snapshot(true), history: [...snapshot(true).history.slice(0, -1), {
      ...snapshot(true).history.at(-1), checksum: 'tampered',
    }] },
    { ...snapshot(true), schema: { ...snapshot(true).schema, students: false } },
  ]) assert.equal(classifySnapshot(s), 'DRIFT');
});
test('only exact staging host, branch, schema and disabling flags allow read-only access', () => {
  const env = validEnv();
  assert.equal(assertAuditTarget(env, ['--audit']), true);
  for (const args of [[], ['--apply'], ['--audit', '--unsafe']]) {
    assert.throws(() => assertAuditTarget(env, args));
  }
  for (const patch of [
    { NODE_ENV: 'production' },
    { SWIMFLOW_PRIVATE_BLOB_ENABLED: 'true' },
    { SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED: 'true' },
    { SWIMFLOW_R2_STORAGE_ENABLED: 'true' },
    { NEON_PROJECT_ID: 'another-project' },
    { NEON_BRANCH_ID: 'br-another-branch' },
    { GITHUB_REF: 'refs/heads/feature' },
    { GITHUB_REPOSITORY: 'other/swim-flow-api' },
    { DIRECT_URL: env.DATABASE_URL },
    { DATABASE_URL: env.DIRECT_URL },
    { DIRECT_URL: env.DIRECT_URL.replace(STAGING.directHost,'another.neon.tech') },
    { DATABASE_URL: env.DATABASE_URL.replace('schema=public','schema=another') },
    { DIRECT_URL: undefined },
  ]) assert.throws(() => assertAuditTarget({ ...env, ...patch }, ['--audit']));
});
test('offline mode never opens a client or needs database credentials', async () => {
  let checked = 0;
  const result = await execute({}, ['--check'], {
    verifyVersionedMigrations: () => { checked++; },
    audit: async () => { throw new Error('Should not contact database'); },
  });
  assert.deepEqual(result, { mode: 'offline', writes: false });
  assert.equal(checked, 1);
});
test('SQL executes within a read-only repeatable-read transaction BEFORE querying', async () => {
  const sql = [];
  const client = {
    $transaction: async (fn, opts) => {
      assert.equal(opts.isolationLevel, 'RepeatableRead');
      return fn({
        $executeRawUnsafe: async query => { sql.push(query); },
        $queryRawUnsafe: async query => {
          sql.push(query);
          return query.includes('current_database()')
            ? [snapshot(false).schema] : snapshot(false).history;
        },
      });
    },
  };
  assert.equal(await audit(client), 'PENDING');
  assert.equal(sql[0], 'SET TRANSACTION READ ONLY');
  assert.ok(sql.slice(1).every(query => /^\s*SELECT /i.test(query)));
});
test('drift fails closed, with no mutation/retry or guessed status', async () => {
  await assert.rejects(audit({
    $transaction: async fn => fn({
      $executeRawUnsafe: async () => undefined,
      $queryRawUnsafe: async sql => sql.includes('current_database()')
        ? [{...snapshot(true).schema, media_objects: false}]
        : snapshot(true).history,
    }),
  }), /Unexpected migration/);
  await assert.rejects(execute(validEnv(), ['--audit'], {
    verifyVersionedMigrations: () => true,
    audit: async () => 'DRIFT',
  }), /not safe/);
});
test('manual GitHub workflow is audit-only; no deploy, schedule, or production flags', () => {
  const path = resolve(__dirname, '..', '.github/workflows/private-media-staging-audit.yml');
  const source = readFileSync(path, 'utf8');
  assert.match(source, /workflow_dispatch:/);
  assert.doesNotMatch(source, /\n  (push|pull_request|schedule|workflow_call):/);
  assert.match(source, /private-media:staging:audit -- --audit/);
  assert.match(source, /environment:/);
  assert.match(source, /swimflow-neon-staging/);
  assert.doesNotMatch(source, /\bmigrate deploy\b|\bmigrate reset\b|\bprisma db push\b/);
});
