'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { checkNeonEnvironment } = require('./neon-preflight.cjs');

const env = {
  DATABASE_URL: 'postgresql://user:secret@ep-test-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
  DIRECT_URL: 'postgresql://user:secret@ep-test.us-east-1.aws.neon.tech/neondb?sslmode=require',
};
test('accepts pooled runtime and direct migration URL for the same Neon DB', () => {
  assert.equal(checkNeonEnvironment(env), true);
});
test('rejects inverted pool/direct and mismatched database', () => {
  assert.throws(() => checkNeonEnvironment({ ...env, DATABASE_URL: env.DIRECT_URL }), /pooled/);
  assert.throws(() => checkNeonEnvironment({ ...env, DIRECT_URL: env.DATABASE_URL }), /direct/);
  assert.throws(() => checkNeonEnvironment({ ...env, DIRECT_URL: env.DIRECT_URL.replace('/neondb?', '/other?') }), /same database/);
});
test('rejects unsafe TLS, non-Neon URLs and missing credentials without leaking secrets', () => {
  for (const value of [
    env.DATABASE_URL.replace('sslmode=require', 'sslmode=disable'),
    env.DATABASE_URL.replace('.neon.tech', '.example.invalid'),
    env.DATABASE_URL.replace('user:secret@', ''),
    'not a url',
  ]) {
    assert.throws(() => checkNeonEnvironment({ ...env, DATABASE_URL: value }),
      (error) => error instanceof Error && !error.message.includes('secret'));
  }
});
test('rejects different Neon endpoints even on the same database', () => {
  assert.throws(() => checkNeonEnvironment({
    ...env, DIRECT_URL: env.DIRECT_URL.replace('ep-test.', 'ep-other.'),
  }), /same Neon endpoint/);
});
