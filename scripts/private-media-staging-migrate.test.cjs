'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const {
  APPROVAL, BASELINE, PRIVATE_MEDIA, STAGING,
  assertTarget, assertSnapshot, fileChecksum,
  execute, inspect,
} = require('./private-media-staging-migrate.cjs');
const { verifyVersionedMigrations } = require('./neon-local-auth-staging.cjs');

function env() {
  return {
    NODE_ENV: 'test',
    GITHUB_REPOSITORY: 'HenriqueTechPro/swim-flow-api',
    GITHUB_REF: 'refs/heads/main',
    SWIMFLOW_PRIVATE_STAGING_MIGRATION_APPROVAL: APPROVAL,
    NEON_PROJECT_ID: STAGING.projectId,
    NEON_BRANCH_ID: STAGING.branchId,
    DATABASE_URL: 'postgresql://lab:fake-password@' + STAGING.pooledHost +
      '/swimflow?sslmode=require&schema=public',
    DIRECT_URL: 'postgresql://lab:fake-password@' + STAGING.directHost +
      '/swimflow?sslmode=require&schema=public',
    SWIMFLOW_PRIVATE_BLOB_ENABLED: 'false',
    SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED: 'false',
    SWIMFLOW_R2_STORAGE_ENABLED: 'false',
  };
}
function history(names) {
  return names.map((migration_name) => ({
    migration_name, checksum: fileChecksum(migration_name), applied: true,
  }));
}
function snapshot(phase) {
  const complete = phase === 'after';
  return {
    schema: {
      database_name: 'swimflow', local_auth: true, students: true,
      teachers: true, parents: true, media_objects: complete,
      active_bindings: complete,
    },
    history: history(complete ? [...BASELINE, ...PRIVATE_MEDIA] : BASELINE),
  };
}

test('all seven reviewed migrations still match pinned immutable bytes', () => {
  assert.equal(verifyVersionedMigrations(), true);
  assert.equal(BASELINE.length, 2);
  assert.equal(PRIVATE_MEDIA.length, 5);
  assert.equal(assertSnapshot(snapshot('before'), 'before'), true);
  assert.equal(assertSnapshot(snapshot('after'), 'after'), true);
});

test('offline --check never needs DB URLs, approval or touches staging', async () => {
  let calls = 0;
  const result = await execute({}, ['--check'], {
    verifyVersionedMigrations: () => { calls++; return true; },
    inspect: () => { throw new Error('Should not query'); },
    migrate: () => { throw new Error('Should not migrate'); },
  });
  assert.deepEqual(result, { approvedMigrations: 5, writes: false });
  assert.equal(calls, 1);
});

test('strictly guards real write target and human approval before DB access', () => {
  const valid = env();
  assert.equal(assertTarget(valid, ['--apply']), true);
  for (const args of [[], ['--check'], ['--apply', '--force']]) {
    assert.throws(() => assertTarget(valid, args));
  }
  const attempts = [
    { NEON_PROJECT_ID: 'another-project' },
    { NEON_BRANCH_ID: 'br-wrongbranch' },
    { SWIMFLOW_PRIVATE_STAGING_MIGRATION_APPROVAL: '' },
    { NODE_ENV: 'production' },
    { SWIMFLOW_PRIVATE_BLOB_ENABLED: 'true' },
    { SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED: 'true' },
    { SWIMFLOW_R2_STORAGE_ENABLED: 'true' },
    { GITHUB_REF: 'refs/heads/feature' },
    { GITHUB_REPOSITORY: 'attacker/swim-flow-api' },
    { DATABASE_URL: valid.DIRECT_URL },
    { DIRECT_URL: valid.DATABASE_URL },
    { DATABASE_URL: valid.DATABASE_URL.replace(STAGING.pooledHost, 'another-pooler.neon.tech') },
    { DIRECT_URL: valid.DIRECT_URL.replace(STAGING.directHost, 'another.neon.tech') },
    { DIRECT_URL: valid.DIRECT_URL.replace('/swimflow?', '/postgres?') },
    { DIRECT_URL: valid.DIRECT_URL.replace('sslmode=require', 'sslmode=disable') },
    { DIRECT_URL: valid.DIRECT_URL.replace('schema=public', 'schema=other') },
    { DIRECT_URL: undefined },
  ];
  for (const patch of attempts) {
    assert.throws(() => assertTarget({ ...valid, ...patch }, ['--apply']),
      undefined, JSON.stringify(Object.keys(patch)));
  }
});

test('unreviewed, failed or partial histories are blocked before deploy', () => {
  const good = snapshot('before');
  for (const broken of [
    { ...good, history: [] },
    { ...good, history: [...good.history, good.history[0]] },
    { ...good, history: good.history.map((r, i) => i ? r : { ...r, applied: false }) },
    { ...good, history: good.history.map((r, i) => i ? r : { ...r, checksum: 'wrong' }) },
    { ...good, schema: { ...good.schema, media_objects: true } },
    { ...good, schema: { ...good.schema, active_bindings: true } },
    { ...good, schema: { ...good.schema, local_auth: false } },
    { ...good, schema: { ...good.schema, database_name: 'another' } },
  ]) {
    assert.throws(() => assertSnapshot(broken, 'before'));
  }
  assert.throws(() => assertSnapshot(good, 'after'));
  assert.throws(() => assertSnapshot(snapshot('after'), 'before'));
});

test('never calls Prisma migrate unless exact preflight passed', async () => {
  const valid = env();
  let migrations = 0;
  await assert.rejects(execute(valid, ['--apply'], {
    verifyVersionedMigrations: () => true,
    inspect: async () => ({ ...snapshot('before'), history: [] }),
    migrate: async () => { migrations++; },
  }));
  assert.equal(migrations, 0);

  const events = [];
  const out = await execute(valid, ['--apply'], {
    verifyVersionedMigrations: () => { events.push('files'); },
    inspect: async () => {
      events.push('inspect');
      return events.includes('migrate') ? snapshot('after') : snapshot('before');
    },
    migrate: async () => { events.push('migrate'); },
    status: async () => { events.push('status'); },
  });
  assert.deepEqual(events, ['files', 'inspect', 'migrate', 'inspect', 'status']);
  assert.equal(out.verified, true);
});

test('does not report success or retry if Prisma fails or after-state is incomplete', async () => {
  const valid = env();
  let calls = 0;
  const failed = {
    verifyVersionedMigrations: () => true,
    inspect: async () => { calls++; return snapshot('before'); },
    migrate: async () => { throw new Error('Database failure'); },
    status: async () => { throw new Error('Should not reach status'); },
  };
  await assert.rejects(execute(valid, ['--apply'], failed), /Database failure/);
  assert.equal(calls, 1);

  calls = 0;
  await assert.rejects(execute(valid, ['--apply'], {
    ...failed,
    migrate: async () => { calls++; },
    inspect: async () => snapshot('before'),
  }), /Unexpected/);
  assert.equal(calls, 1);
});

test('inspection calls only fixed SELECT statements', async () => {
  const queries = [];
  const client = {
    $queryRawUnsafe: async (sql) => {
      queries.push(sql);
      return sql.includes('current_database()') ? [snapshot('before').schema] : snapshot('before').history;
    },
  };
  const result = await inspect(client);
  assert.equal(result.history.length, 2);
  assert.equal(queries.length, 2);
  assert.ok(queries.every((sql) => /^\s*SELECT /i.test(sql)));
  assert.ok(queries.every((sql) => !/DELETE\s+FROM|DROP\s+TABLE/i.test(sql)));
});

test('manual workflow never runs during PR, push, deploy or schedule', () => {
  const source = readFileSync(resolve(__dirname, '..', '.github/workflows/private-media-staging-migrations.yml'), 'utf8');
  assert.match(source, /workflow_dispatch:/);
  assert.doesNotMatch(source, /\n  (push|pull_request|schedule|workflow_call):/);
  assert.match(source, /github\.ref == 'refs\/heads\/main'/);
  assert.match(source, /github\.repository == 'HenriqueTechPro\/swim-flow-api'/);
  assert.match(source, /name: swimflow-neon-staging/);
  assert.match(source, /SWIMFLOW_STAGING_DIRECT_URL/);
  assert.match(source, /SWIMFLOW_PRIVATE_STAGING_MIGRATION_APPROVAL/);
  assert.ok(source.indexOf('secrets.SWIMFLOW_STAGING_DIRECT_URL') >
    source.indexOf('Install locked API dependencies'));
  assert.doesNotMatch(source, /\b(migrate reset|db push)\b/);
});

test('approval typo fails visibly before staging secrets, never a silent job skip', () => {
  const source = readFileSync(resolve(__dirname, '..', '.github/workflows/private-media-staging-migrations.yml'), 'utf8');
  assert.match(source, /  validate-approval:/);
  assert.match(source, /    needs: validate-approval/);
  assert.match(source, /APPROVAL_INPUT: \$\{\{ inputs\.approval \}\}/);
  assert.match(source, /::error title=Incorrect migration approval/);
  const [preflight, protectedJob] = source.split('  private-media-staging:');
  assert.ok(protectedJob, 'Missing protected migration job');
  assert.doesNotMatch(preflight, /secrets\.|environment:/);
  assert.match(protectedJob, /environment:\s*\n\s*name: swimflow-neon-staging/);
  assert.match(protectedJob, /SWIMFLOW_PRIVATE_STAGING_MIGRATION_APPROVAL: \$\{\{ inputs\.approval \}\}/);
  assert.match(protectedJob, /npm run private-media:staging -- --apply/);
});

test('manual approval is a deliberate choice with safe default for mobile', () => {
  const source = readFileSync(resolve(__dirname, '..', '.github/workflows/private-media-staging-migrations.yml'), 'utf8');
  const input = source.split('      approval:')[1]?.split('\npermissions:')[0];
  assert.ok(input, 'Missing workflow approval input');
  assert.match(input, /required: true/);
  assert.match(input, /type: choice/);
  assert.match(input, /default: DO_NOT_APPLY/);
  assert.match(input, /options:\s*\n\s*- DO_NOT_APPLY\s*\n\s*- APPLY_ONLY_PRIVATE_MEDIA_MIGRATIONS_TO_NEON_STAGING/);
  assert.match(source, /expected='APPLY_ONLY_PRIVATE_MEDIA_MIGRATIONS_TO_NEON_STAGING'/);
  assert.match(source, /    needs: validate-approval/);
  assert.match(source, /SWIMFLOW_PRIVATE_STAGING_MIGRATION_APPROVAL: \$\{\{ inputs\.approval \}\}/);
  assert.throws(() => assertTarget({
    ...env(), SWIMFLOW_PRIVATE_STAGING_MIGRATION_APPROVAL: 'DO_NOT_APPLY',
  }, ['--apply']));
});
