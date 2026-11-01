'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const {
  AUDIENCE, createStagingReadOnlyProbe, verifyStagingReadOnlyProbe,
} = require('./private-blob-broker-auth-v1.cjs');

const KEY = randomBytes(32).toString('base64url');
const OTHER_KEY = randomBytes(32).toString('base64url');
const NOW = 1793567000000;
const DENIED = /blob-broker-probe-not-authorized/;
const claim = () => Promise.resolve(true);

test('signs only a staging synthetic HEAD, never an athlete photo key', async () => {
  const request = createStagingReadOnlyProbe(KEY, NOW);
  assert.equal(request.version, 1);
  assert.equal(request.audience, AUDIENCE);
  assert.equal(request.operation, 'head');
  assert.match(request.pathname, /^__swimflow-broker-probe\/v1\/[0-9a-f-]{36}\.txt$/);
  assert.match(request.signature, /^[A-Za-z0-9_-]{43}$/);
  assert.ok(!JSON.stringify(request).includes(KEY));
  assert.ok(!JSON.stringify(request).includes('private/students/'));
  const result = await verifyStagingReadOnlyProbe(KEY, request, {
    nowMs: NOW, claimNonce: claim,
  });
  assert.deepEqual(result, { operation: 'head', pathname: request.pathname });
});

test('requires a distinct 32-byte base64url key, never lab OIDC or RW credential', async () => {
  const valid = createStagingReadOnlyProbe(KEY, NOW);
  for (const invalid of [
    '', 'short', 'A'.repeat(42), 'A'.repeat(44),
    'vercel_blob_rw_PJZzrdBiiVcRyLHj_fake',
    'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJsb2NhbCJ9.signature',
    ' ' + KEY, KEY + '\n',
  ]) {
    assert.throws(() => createStagingReadOnlyProbe(invalid, NOW), DENIED);
    await assert.rejects(verifyStagingReadOnlyProbe(invalid, valid, {
      nowMs: NOW, claimNonce: claim,
    }), DENIED);
  }
  await assert.rejects(verifyStagingReadOnlyProbe(OTHER_KEY, valid, {
    nowMs: NOW, claimNonce: claim,
  }), DENIED);
});

test('rejects tampering with method, audience, path, issued time, nonce, signature and version', async () => {
  const input = createStagingReadOnlyProbe(KEY, NOW);
  const mutations = [
    { operation: 'put' },
    { operation: 'delete' },
    { operation: 'get' },
    { audience: 'swim-flow-blob-production' },
    { pathname: 'private/students/11111111-1111-4111-8111-111111111111/a.jpg' },
    { pathname: '../private' },
    { issuedAtMs: NOW + 1 },
    { nonce: '00000000-0000-4000-8000-000000000000' },
    { signature: 'A'.repeat(43) },
    { version: 2 },
    { elevated: true },
    { pathname: undefined },
  ];
  for (const mutation of mutations) {
    let nonceCalls = 0;
    await assert.rejects(verifyStagingReadOnlyProbe(KEY, { ...input, ...mutation }, {
      nowMs: NOW, claimNonce: async () => { nonceCalls++; return true; },
    }), DENIED);
    assert.equal(nonceCalls, 0, 'unauthenticated request claimed a nonce');
  }
});

test('rejects expired and future-dated envelopes before consulting replay storage', async () => {
  const input = createStagingReadOnlyProbe(KEY, NOW);
  for (const nowMs of [NOW - 30001, NOW + 30001, NaN, Infinity, -1]) {
    let calls = 0;
    await assert.rejects(verifyStagingReadOnlyProbe(KEY, input, {
      nowMs, claimNonce: async () => { calls++; return true; },
    }), DENIED);
    assert.equal(calls, 0);
  }
  await verifyStagingReadOnlyProbe(KEY, input, { nowMs: NOW + 30000, claimNonce: claim });
});

test('requires a durable nonce claim implementation; denies replays and storage errors', async () => {
  const input = createStagingReadOnlyProbe(KEY, NOW);
  await assert.rejects(verifyStagingReadOnlyProbe(KEY, input, {
    nowMs: NOW,
  }), DENIED);
  const used = new Set();
  const atomicClaim = async (nonce, expiresAtMs) => {
    assert.match(nonce, /^swim-flow-blob-staging-broker-v1:[0-9a-f-]{36}$/);
    assert.equal(expiresAtMs, NOW + 31000);
    if (used.has(nonce)) return false;
    used.add(nonce);
    return true;
  };
  await verifyStagingReadOnlyProbe(KEY, input, {
    nowMs: NOW, claimNonce: atomicClaim,
  });
  await assert.rejects(verifyStagingReadOnlyProbe(KEY, input, {
    nowMs: NOW, claimNonce: atomicClaim,
  }), DENIED);
  await assert.rejects(verifyStagingReadOnlyProbe(KEY, input, {
    nowMs: NOW, claimNonce: async () => { throw new Error('sensitive DB connection string'); },
  }), DENIED);
});

test('only accepts explicit true from claimNonce; cannot treat truthy strings as approval', async () => {
  const input = createStagingReadOnlyProbe(KEY, NOW);
  for (const result of [false, null, undefined, 'true', 1]) {
    await assert.rejects(verifyStagingReadOnlyProbe(KEY, input, {
      nowMs: NOW, claimNonce: async () => result,
    }), DENIED);
  }
});

test('signing a fresh probe uses independent path and nonce', () => {
  const a = createStagingReadOnlyProbe(KEY, NOW);
  const b = createStagingReadOnlyProbe(KEY, NOW);
  assert.notEqual(a.pathname, b.pathname);
  assert.notEqual(a.nonce, b.nonce);
  assert.notEqual(a.signature, b.signature);
});
