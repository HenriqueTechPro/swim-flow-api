'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  APPROVAL,
  FROM,
  validateSmokeInput,
  sendSmokeEmail,
} = require('./resend-delivery-smoke.cjs');

const testKey = 're_UnitTestOnlyNotReal';
const recipient = 'account-owner@example.invalid';
const validEnv = {
  SWIMFLOW_RESEND_SMOKE_APPROVAL: APPROVAL,
  RESEND_API_KEY: testKey,
  SWIMFLOW_RESEND_SMOKE_TO: recipient,
  RESEND_FROM_EMAIL: FROM,
};

test('requires exact manual approval and explicit --send before network call', () => {
  for (const args of [[], ['--dry-run'], ['--send', '--send'], ['--apply']]) {
    assert.throws(() => validateSmokeInput(validEnv, args));
  }
  assert.throws(() => validateSmokeInput({
    ...validEnv, SWIMFLOW_RESEND_SMOKE_APPROVAL: '',
  }, ['--send']));
});

test('rejects invalid secrets, multiple recipients, and non-test senders', () => {
  for (const patch of [
    { RESEND_API_KEY: undefined },
    { RESEND_API_KEY: 'invalid' },
    { SWIMFLOW_RESEND_SMOKE_TO: '' },
    { SWIMFLOW_RESEND_SMOKE_TO: 'first@example.invalid,second@example.invalid' },
    { SWIMFLOW_RESEND_SMOKE_TO: 'not-an-email' },
    { RESEND_FROM_EMAIL: 'admin@example.invalid' },
  ]) {
    assert.throws(() => validateSmokeInput({ ...validEnv, ...patch }, ['--send']));
  }
});

test('normalizes the recipient and only sends a harmless diagnostic email', async () => {
  const input = validateSmokeInput({
    ...validEnv, SWIMFLOW_RESEND_SMOKE_TO: '  ACCOUNT-OWNER@EXAMPLE.INVALID  ',
  }, ['--send']);
  assert.equal(input.recipient, recipient);

  const calls = [];
  const fakeFetch = async (...args) => {
    calls.push(args);
    return { ok: true };
  };
  assert.equal(await sendSmokeEmail(input, fakeFetch), true);
  assert.equal(calls.length, 1);
  const [url, options] = calls[0];
  assert.equal(url, 'https://api.resend.com/emails');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.Authorization, `Bearer ${testKey}`);
  assert.equal(options.headers['Content-Type'], 'application/json');
  const data = JSON.parse(options.body);
  assert.deepEqual(data.to, [recipient]);
  assert.equal(data.from, FROM);
  assert.match(data.subject, /Teste de entrega/);
  assert.ok(!JSON.stringify(data).includes(testKey));
  for (const prohibited of ['token=', 'https://swim-flow', 'password', 'admin@example']) {
    assert.ok(!JSON.stringify(data).includes(prohibited));
  }
  assert.equal(options.signal.aborted, false);
});

test('provider failures remain generic and never trigger retries', async () => {
  const input = validateSmokeInput(validEnv, ['--send']);
  let count = 0;
  await assert.rejects(
    sendSmokeEmail(input, async () => {
      count += 1;
      return { ok: false, status: 403, body: 'do-not-log-credentials' };
    }),
    /Resend delivery request not accepted/,
  );
  assert.equal(count, 1);
  await assert.rejects(
    sendSmokeEmail(input, async () => {
      throw new Error('private-provider-error-should-not-be-printed');
    }),
  );
});

test('module has no side effects, imports or database provisioning dependencies', () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(require.resolve('./resend-delivery-smoke.cjs'), 'utf8');
  assert.ok(!source.includes("require('@prisma/client')"));
  assert.ok(!source.includes('bootstrapFirstAdmin('));
  assert.ok(!source.includes('sendInvitation('));
  assert.ok(!source.includes('process.env.DATABASE_URL'));
});
