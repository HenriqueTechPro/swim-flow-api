'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertDisposablePostgres } = require('./bootstrap-disposable-guard.cjs');

const valid = () => ({
  SWIMFLOW_DISPOSABLE_DB: 'yes',
  DATABASE_URL: 'postgresql://ci:ci@localhost:5432/swimflow?schema=public',
  DIRECT_URL: 'postgresql://ci:ci@127.0.0.1:5432/swimflow?schema=public',
});

test('accepts only both disposable local Postgres URLs', () => {
  assert.doesNotThrow(() => assertDisposablePostgres(valid()));
  for (const patch of [
    { SWIMFLOW_DISPOSABLE_DB: '' },
    { DATABASE_URL: 'postgresql://user:pass@prod.neon.tech/swimflow' },
    { DIRECT_URL: 'postgresql://user:pass@prod.neon.tech/swimflow' },
    { DIRECT_URL: 'postgresql://ci:ci@localhost:5432/production' },
    { DATABASE_URL: 'postgresql://ci:ci@localhost:5433/swimflow' },
    { DATABASE_URL: '' },
    { DIRECT_URL: '' },
  ]) {
    assert.throws(() => assertDisposablePostgres({ ...valid(), ...patch }));
  }
});
