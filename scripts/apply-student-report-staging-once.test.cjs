'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFileSync, readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const {
  assertEnvironment,
  assertSnapshot,
} = require('./apply-student-report-staging-once.cjs');
const { STAGING } = require('./neon-local-auth-staging.cjs');

const migrations = readdirSync(resolve(__dirname, '../prisma/migrations'), {
  withFileTypes: true,
}).filter((item) => item.isDirectory() && /^\d{14}_/.test(item.name))
  .map((item) => item.name).sort();

function history(names) {
  return names.map((name) => ({
    migration_name: name,
    checksum: createHash('sha256').update(
      readFileSync(resolve(__dirname, '../prisma/migrations', name, 'migration.sql')),
    ).digest('hex'),
    applied: true,
  }));
}

const targetEnv = {
  GITHUB_REPOSITORY: 'HenriqueTechPro/swim-flow-api',
  GITHUB_REF: 'refs/heads/main',
  GITHUB_EVENT_NAME: 'push',
  NODE_ENV: 'test',
  NEON_PROJECT_ID: STAGING.projectId,
  NEON_BRANCH_ID: STAGING.branchId,
  SWIMFLOW_STUDENT_REPORT_STAGING_APPROVAL: 'APPLY_STUDENT_REPORT_TO_NEON_STAGING',
  DATABASE_URL: 'postgresql://test:fictional@' + STAGING.pooledHost +
    '/swimflow?schema=public&sslmode=require',
  DIRECT_URL: 'postgresql://test:fictional@' + STAGING.directHost +
    '/swimflow?schema=public&sslmode=require',
};

function snapshot(after) {
  return {
    row: {
      database_name: STAGING.database,
      application_tables: BigInt(after ? 40 : 39),
      categories: BigInt(28),
      has_observations: after,
      observation_foreign_keys: BigInt(after ? 4 : 0),
    },
    history: history(after ? migrations : migrations.slice(0, -2)),
  };
}

test('pins the specific staging hosts, branch, repository and approval', () => {
  assert.doesNotThrow(() => assertEnvironment(targetEnv));
  for (const [key, bad] of [
    ['GITHUB_REF', 'refs/heads/main'],
    ['GITHUB_REPOSITORY', 'another-owner/repo'],
    ['GITHUB_EVENT_NAME', 'pull_request'],
    ['NEON_BRANCH_ID', 'br-unapproved'],
    ['NODE_ENV', 'production'],
    ['SWIMFLOW_STUDENT_REPORT_STAGING_APPROVAL', 'NO'],
    ['DIRECT_URL', targetEnv.DIRECT_URL.replace(STAGING.directHost, 'ep-wrong.neon.tech')],
  ]) {
    assert.throws(() => assertEnvironment({ ...targetEnv, [key]: bad }));
  }
});

test('preflight requires exactly ten completed, checksummed migrations', () => {
  assert.equal(migrations.length, 12);
  assert.doesNotThrow(() => assertSnapshot(snapshot(false), false));
  assert.throws(() => assertSnapshot(snapshot(true), false));
  const bad = snapshot(false);
  bad.history[0].checksum = 'bad';
  assert.throws(() => assertSnapshot(bad, false));
});

test('postflight requires both reviewed migrations, exactly four report FKs', () => {
  assert.doesNotThrow(() => assertSnapshot(snapshot(true), true));
  const bad = snapshot(true);
  bad.row.observation_foreign_keys = BigInt(3);
  assert.throws(() => assertSnapshot(bad, true));
});
