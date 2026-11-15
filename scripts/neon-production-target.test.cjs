'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { TARGET, verifyMigrationSet, verifyProductionTarget } = require('./neon-production-target.cjs');

const valid = () => ({
  NEON_PROJECT_ID: TARGET.projectId,
  NEON_BRANCH_ID: TARGET.branchId,
  SWIMFLOW_PRODUCTION_MIGRATION_APPROVAL: TARGET.acknowledgement,
  DATABASE_URL: 'postgresql://role:secret@' + TARGET.pooledHost + '/swimflow?sslmode=require',
  DIRECT_URL: 'postgresql://role:secret@' + TARGET.directHost + '/swimflow?sslmode=require',
});

test('repository contains exactly the reviewed 12 migrations', () => {
  assert.equal(verifyMigrationSet(), 12);
});

test('accepts approved project, branch and distinct pooled/direct hosts', () => {
  assert.equal(verifyProductionTarget(valid()), true);
});

test('rejects staging branch and missing explicit authorization', () => {
  const env = valid();
  env.NEON_BRANCH_ID = 'br-gentle-wildflower-b7qrnd74';
  assert.throws(() => verifyProductionTarget(env));
  env.NEON_BRANCH_ID = TARGET.branchId;
  delete env.SWIMFLOW_PRODUCTION_MIGRATION_APPROVAL;
  assert.throws(() => verifyProductionTarget(env));
});

test('rejects Neon staging host, non-TLS, swapped hosts and mismatched database', () => {
  const env = valid();
  env.DIRECT_URL = env.DIRECT_URL.replace(TARGET.directHost, 'ep-old-lake-b7qha3a0.c-13.us-east-1.aws.neon.tech');
  assert.throws(() => verifyProductionTarget(env));
  env.DIRECT_URL = valid().DIRECT_URL.replace('sslmode=require', 'sslmode=disable');
  assert.throws(() => verifyProductionTarget(env));
  env.DIRECT_URL = valid().DATABASE_URL;
  assert.throws(() => verifyProductionTarget(env));
  env.DIRECT_URL = valid().DIRECT_URL.replace('/swimflow', '/neondb');
  assert.throws(() => verifyProductionTarget(env));
});

test('rejects missing password and mismatched roles', () => {
  const env = valid();
  env.DATABASE_URL = env.DATABASE_URL.replace('role:secret', 'role');
  assert.throws(() => verifyProductionTarget(env));
  env.DATABASE_URL = valid().DATABASE_URL.replace('role:secret', 'different:secret');
  assert.throws(() => verifyProductionTarget(env));
});
