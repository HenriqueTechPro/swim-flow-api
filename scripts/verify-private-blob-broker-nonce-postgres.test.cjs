'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { assertCiDisposable } = require('./verify-private-blob-broker-nonce-postgres.cjs');

const CI = Object.freeze({
  SWIMFLOW_DISPOSABLE_DB: 'yes',
  CI: 'true',
  GITHUB_ACTIONS: 'true',
  GITHUB_WORKFLOW: 'PostgreSQL baseline quality gate',
  GITHUB_REPOSITORY: 'HenriqueTechPro/swim-flow-api',
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://ci:ci@localhost:5432/swimflow?schema=public',
  DIRECT_URL: 'postgresql://ci:ci@localhost:5432/swimflow?schema=public',
});

test('accepts the exact isolated GitHub disposable PostgreSQL service only', () => {
  assert.doesNotThrow(() => assertCiDisposable(CI));
  assert.doesNotThrow(() => assertCiDisposable({
    ...CI,
    DATABASE_URL: 'postgresql://ci:ci@127.0.0.1:5432/swimflow?schema=public',
  }));
});

test('blocks manual local, Render, production and unapproved invocations', () => {
  for (const override of [
    { SWIMFLOW_DISPOSABLE_DB: undefined },
    { CI: undefined },
    { GITHUB_ACTIONS: undefined },
    { GITHUB_WORKFLOW: 'API quality gate' },
    { GITHUB_REPOSITORY: 'attacker/fork' },
    { NODE_ENV: 'production' },
  ]) {
    assert.throws(() => assertCiDisposable({ ...CI, ...override }),
      /broker-postgres-ci-disposable-approval-required/);
  }
});

test('blocks any non-local Neon/Render/production DB URL in either field', () => {
  for (const field of ['DATABASE_URL', 'DIRECT_URL']) {
    for (const value of [
      undefined,
      'postgresql://secret:secret@ep-neon.example.com:5432/swimflow?schema=public',
      'postgresql://ci:ci@localhost:5432/production?schema=public',
      'postgresql://ci:ci@localhost:5432/swimflow?schema=other',
      'postgresql://ci:ci@localhost:5432/swimflow',
      'postgresql://ci:ci@localhost:5432/swimflow?schema=public&sslmode=require',
      'postgresql://other:ci@localhost:5432/swimflow?schema=public',
      'postgresql://ci:wrong@localhost:5432/swimflow?schema=public',
      'postgresql://ci:ci@localhost:5433/swimflow?schema=public',
      'postgres://ci:ci@localhost:5432/swimflow?schema=public',
      'postgresql://ci:ci@10.0.0.1:5432/swimflow?schema=public',
      'postgresql://ci:ci@localhost:5432/swimflow?schema=public#fragment',
    ]) {
      assert.throws(() => assertCiDisposable({ ...CI, [field]: value }),
        /broker-postgres-ci-nonlocal-database-refused/);
    }
  }
});
