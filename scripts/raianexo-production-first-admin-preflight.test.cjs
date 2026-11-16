'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { EXPECTED_MIGRATIONS, TARGET } = require('./neon-production-target.cjs');
const { APPROVAL } = require('./bootstrap-production-first-admin.cjs');
const { assertOperation, validateState, inspectProduction } = require('./raianexo-production-first-admin-preflight.cjs');

const state = () => ({ profiles: 0, admins: 0, identities: 0, sessions: 0, pending: 0 });
const env = () => ({
  DATABASE_URL: 'postgresql://owner:secret@' + TARGET.pooledHost + '/swimflow?sslmode=require',
  DIRECT_URL: 'postgresql://owner:secret@' + TARGET.directHost + '/swimflow?sslmode=require',
  NEON_PROJECT_ID: TARGET.projectId,
  NEON_BRANCH_ID: TARGET.branchId,
  SWIMFLOW_PRODUCTION_BOOTSTRAP_ADMIN_APPROVAL: APPROVAL,
});

test('allowed operations are explicit and unknown operation is denied', () => {
  for (const name of ['inspect', 'apply', 'resend', 'retarget']) assert.equal(assertOperation(name), name);
  for (const name of ['--apply', '', 'reset', 'seed', 'migrate']) assert.throws(() => assertOperation(name));
});

test('inspect is read-only and allows empty and pending administrator states', () => {
  assert.ok(validateState(state(), EXPECTED_MIGRATIONS, 'inspect'));
  assert.ok(validateState({ profiles: 1, admins: 1, identities: 1, sessions: 0, pending: 1 }, EXPECTED_MIGRATIONS, 'inspect'));
});
test('apply only accepts an entirely empty, migrated database', () => {
  assert.ok(validateState(state(), EXPECTED_MIGRATIONS, 'apply'));
  for (const key of Object.keys(state())) {
    assert.throws(() => validateState({ ...state(), [key]: 1 }, EXPECTED_MIGRATIONS, 'apply'));
  }
});
test('resend only accepts one unactivated administrator, no sessions', () => {
  const pending = { profiles: 1, admins: 1, identities: 1, sessions: 0, pending: 1 };
  assert.ok(validateState(pending, EXPECTED_MIGRATIONS, 'resend'));
  for (const key of Object.keys(pending)) {
    assert.throws(() => validateState({ ...pending, [key]: pending[key] + 1 }, EXPECTED_MIGRATIONS, 'resend'));
  }
  assert.throws(() => validateState({ ...pending, pending: 0 }, EXPECTED_MIGRATIONS, 'resend'));
});
test('retarget only accepts one pending administrator with no sessions', () => {
  const pending = { profiles: 1, admins: 1, identities: 1, sessions: 0, pending: 1 };
  assert.ok(validateState(pending, EXPECTED_MIGRATIONS, 'retarget'));
  assert.throws(() => validateState(state(), EXPECTED_MIGRATIONS, 'retarget'));
  for (const key of Object.keys(pending)) {
    assert.throws(() => validateState({
      ...pending, [key]: pending[key] + 1,
    }, EXPECTED_MIGRATIONS, 'retarget'));
  }
  assert.throws(() => validateState({ ...pending, pending: 0 }, EXPECTED_MIGRATIONS, 'retarget'));
});

test('migrations must match all reviewed production migration names', () => {
  assert.throws(() => validateState(state(), EXPECTED_MIGRATIONS.slice(0, -1), 'inspect'));
  assert.throws(() => validateState(state(), [...EXPECTED_MIGRATIONS.slice(1), EXPECTED_MIGRATIONS[0]], 'inspect'));
});

test('read-only inspect queries the approved Neon target and does not write', async () => {
  const calls=[];
  const prisma = {
    $queryRaw: async (strings) => {
      calls.push(String(strings[0]));
      return calls.length === 1 ? [state()] : EXPECTED_MIGRATIONS.map(migration_name => ({ migration_name }));
    },
  };
  await inspectProduction(prisma, 'inspect', env());
  assert.equal(calls.length, 2);
  assert.ok(calls.every(s => s.trim().toUpperCase().startsWith('SELECT')));
  assert.ok(calls.every(s => !/INSERT|UPDATE|DELETE|CREATE|DROP|ALTER/i.test(s)));
  await assert.rejects(() => inspectProduction(prisma, 'inspect', {...env(), NEON_PROJECT_ID:'raspy-breeze-33258358'}));
});

test('workflow is gated to manual main and protected production environment, no automatic writes', () => {
  const yml = readFileSync(resolve(__dirname, '../.github/workflows/raianexo-production-first-admin.yml'), 'utf8');
  assert.match(yml, /workflow_dispatch:/);
  assert.doesNotMatch(yml, /^  push:/m);
  assert.doesNotMatch(yml, /^  schedule:/m);
  assert.match(yml, /github\.ref == 'refs\/heads\/main'/);
  assert.match(yml, /github\.repository == 'HenriqueTechPro\/swim-flow-api'/);
  assert.match(yml, /name: swimflow-neon-production/);
  assert.match(yml, /CREATE_RAIANEXO_FIRST_ADMIN/);
  assert.match(yml, /RESEND_RAIANEXO_FIRST_ADMIN/);
  assert.match(yml, /RETARGET_RAIANEXO_PENDING_ADMIN/);
  assert.match(yml, /scripts\\/retarget-production-pending-admin.cjs --retarget/);
  assert.match(yml, /RAIANEXO_RESEND_API_KEY/);
  assert.match(yml, /SWIMFLOW_PRODUCTION_DATABASE_URL/);
  assert.match(yml, /SWIMFLOW_PRODUCTION_DIRECT_URL/);
  assert.match(yml, /scripts\/raianexo-production-first-admin-preflight.cjs/);
  assert.match(yml, /node scripts\/bootstrap-production-first-admin.cjs --apply/);
  assert.match(yml, /node scripts\/bootstrap-production-first-admin.cjs --resend/);
  assert.doesNotMatch(yml, /npm run prisma:migrate:deploy|seed:smoke|SWIMFLOW_STAGING_DATABASE_URL/);
  assert.match(yml, /if: \$\{\{ inputs.operation == 'apply' \|\| inputs.operation == 'resend' \}\}/);
});
