'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { expectedHost, verifyUrl } = require('./verify-private-blob-live.cjs');

const storeId = 'store_abcdefgh12345678';
const pathname = 'private/profiles/' +
  '11111111-1111-4111-8111-111111111111/' +
  '22222222-2222-4222-8222-222222222222.png';
const host = expectedHost(storeId);
const url = 'https://' + host + '/' + pathname;

test('synthetic URL must match token store ID, private host, and exact path', () => {
  assert.equal(host, 'abcdefgh12345678.private.blob.vercel-storage.com');
  assert.doesNotThrow(() => verifyUrl(url, pathname, host));
  for (const invalid of [
    'http://' + host + '/' + pathname,
    'https://abcdefgh12345678.public.blob.vercel-storage.com/' + pathname,
    'https://evil.private.blob.vercel-storage.com/' + pathname,
    'https://' + host + '/' + pathname + '/another',
    url + '?secret=1',
    url + '#fragment',
  ]) {
    assert.throws(() => verifyUrl(invalid, pathname, host),
      /blob-smoke-unexpected-private-store-host/);
  }
});
