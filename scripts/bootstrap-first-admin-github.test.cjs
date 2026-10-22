'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const {
  STAGING, prepareStagingBootstrap, runStagingBootstrap,
} = require('./bootstrap-first-admin-github.cjs');

function validEnvironment() {
  return {
    NEON_PROJECT_ID: STAGING.projectId,
    NEON_BRANCH_ID: STAGING.branchId,
    SWIMFLOW_BOOTSTRAP_ADMIN_APPROVAL: STAGING.approval,
    DIRECT_URL: `postgresql://ci:ci@${STAGING.directHost}/swimflow?sslmode=require&schema=public`,
    DATABASE_URL: `postgresql://ci:ci@${STAGING.pooledHost}/swimflow?sslmode=require&schema=public`,
    SWIMFLOW_STAGING_FIRST_ADMIN_EMAIL: '  ADMIN@EXAMPLE.INVALID  ',
    SWIMFLOW_STAGING_FIRST_ADMIN_NAME: '  Primeiro Administrador  ',
    SWIMFLOW_STAGING_FIRST_ADMIN_PASSWORD: 'staging-unique-secret-2026',
  };
}

test('safe wrapper forwards password by stdin only and canonicalizes account data', () => {
  const source = validEnvironment();
  const prepared = prepareStagingBootstrap(source, ['--apply']);
  assert.equal(prepared.input.toString('utf8'), 'staging-unique-secret-2026\n');
  assert.equal(prepared.childEnv.SWIMFLOW_BOOTSTRAP_ADMIN_EMAIL, 'admin@example.invalid');
  assert.equal(prepared.childEnv.SWIMFLOW_BOOTSTRAP_ADMIN_NAME, 'Primeiro Administrador');
  assert.equal(prepared.childEnv.SWIMFLOW_STAGING_FIRST_ADMIN_PASSWORD, undefined);
  assert.equal(prepared.childEnv.SWIMFLOW_STAGING_FIRST_ADMIN_EMAIL, undefined);
  assert.equal(prepared.childEnv.SWIMFLOW_STAGING_FIRST_ADMIN_NAME, undefined);
  assert.equal(prepared.childEnv.SWIMFLOW_BOOTSTRAP_ADMIN_PASSWORD, undefined);
  assert.equal(source.SWIMFLOW_STAGING_FIRST_ADMIN_PASSWORD, 'staging-unique-secret-2026');

  let inputBuffer;
  const output = runStagingBootstrap(source, ['--apply'], (runtime, argv, options) => {
    assert.equal(runtime, process.execPath);
    assert.equal(argv[1], '--apply');
    assert.equal(argv.length, 2);
    assert.equal(options.env.SWIMFLOW_STAGING_FIRST_ADMIN_PASSWORD, undefined);
    assert.equal(options.env.SWIMFLOW_BOOTSTRAP_ADMIN_PASSWORD, undefined);
    assert.equal(options.stdio[0], 'pipe');
    inputBuffer = options.input;
    assert.equal(options.input.toString(), 'staging-unique-secret-2026\n');
    return { status: 0, stdout: 'Staging administrator provisioned: ci-only-id' };
  });
  assert.deepEqual(output, { success: true });
  assert.ok(inputBuffer.every((value) => value === 0), 'Buffer wiped after execution');
});

test('fails closed for missing approval, mismatched branch, TLS and schema errors', () => {
  const input = validEnvironment();
  assert.throws(() => prepareStagingBootstrap(input, []));
  for (const patch of [
    { SWIMFLOW_BOOTSTRAP_ADMIN_APPROVAL: '' },
    { NEON_BRANCH_ID: 'br-other' },
    { DIRECT_URL: input.DIRECT_URL.replace('sslmode=require', 'sslmode=disable') },
    { DATABASE_URL: input.DATABASE_URL.replace('schema=public', 'schema=other') },
    { DATABASE_URL: input.DATABASE_URL.replace('swimflow?', 'prod?') },
    { SWIMFLOW_STAGING_FIRST_ADMIN_PASSWORD: '' },
    { SWIMFLOW_STAGING_FIRST_ADMIN_NAME: '' },
    { SWIMFLOW_STAGING_FIRST_ADMIN_EMAIL: '' },
    { SWIMFLOW_STAGING_FIRST_ADMIN_PASSWORD: 'short' },
    { SWIMFLOW_STAGING_FIRST_ADMIN_PASSWORD: 'á'.repeat(40) },
    { SWIMFLOW_STAGING_FIRST_ADMIN_PASSWORD: 'line1\nline2' },
  ]) {
    assert.throws(() => prepareStagingBootstrap({ ...input, ...patch }, ['--apply']));
  }
});

test('never forwards captured child logs or retries failed account creation', () => {
  const env = validEnvironment();
  let attempts = 0;
  assert.throws(() => runStagingBootstrap(env, ['--apply'], (_runtime, _argv, opts) => {
    attempts++;
    assert.equal(opts.env.SWIMFLOW_STAGING_FIRST_ADMIN_PASSWORD, undefined);
    return { status: 1, stderr: 'CI MOCK PRIVATE DB DETAILS', stdout: 'PRIVATE' };
  }), /did not complete/);
  assert.equal(attempts, 1);
});

const workflow = readFileSync(resolve(__dirname, '../.github/workflows/neon-first-admin-staging-manual.yml'), 'utf8');

test('workflow requires manual authorization, main branch, and correct protected environment', () => {
  assert.match(workflow, /^on:\s*\n\s+workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^\s+(push|pull_request|schedule|workflow_call|repository_dispatch):/m);
  assert.match(workflow, /github\.event_name == 'workflow_dispatch'/);
  assert.match(workflow, /github\.repository == 'HenriqueTechPro\/swim-flow-api'/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /github\.run_attempt == 1/);
  assert.match(workflow, /inputs\.confirmation == 'BOOTSTRAP_SWIM_FLOW_STAGING_ADMIN_ONCE'/);
  assert.match(workflow, /environment:\s*\n\s+name: swimflow-neon-staging/);
  assert.match(workflow, /group: swimflow-neon-staging-local-auth-schema/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /permissions:\s*\n\s+contents: read/);
});

test('admin and database secrets are never visible to install, tests or codegen', () => {
  const marker = '      - name: Bootstrap one administrator exactly once';
  const split = workflow.split(marker);
  assert.equal(split.length, 2);
  const before = split[0];
  assert.doesNotMatch(before, /SWIMFLOW_STAGING_FIRST_ADMIN_(EMAIL|NAME|PASSWORD)/);
  const after = split[1];
  for (const name of ['EMAIL','NAME','PASSWORD']) {
    assert.match(after, new RegExp('secrets\\.SWIMFLOW_STAGING_FIRST_ADMIN_' + name));
  }
  assert.match(after, /SWIMFLOW_STAGING_DIRECT_URL/);
  assert.match(after, /SWIMFLOW_STAGING_DATABASE_URL/);
  assert.match(after, /node scripts\/bootstrap-first-admin-github\.cjs --apply/);
  assert.doesNotMatch(after, /echo .*PASSWORD|printf .*PASSWORD|::add-mask::|set -x/i);
});
