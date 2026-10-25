'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertCorsResponse } = require('./verify-private-media-r2-live.cjs');

const ORIGIN = 'https://swimflow-test.vercel.app';

function response(headers, status = 204) {
  return new Response(null, { status, headers });
}

test('CORS preflight requires exact origin, method and both signed PUT headers', () => {
  const ok = response({
    'access-control-allow-origin': ORIGIN,
    'access-control-allow-methods': 'GET, PUT',
    'access-control-allow-headers': 'content-type, if-none-match, if-match',
  });
  assert.doesNotThrow(() =>
    assertCorsResponse(ok, ORIGIN, 'PUT', ['content-type', 'if-none-match']));
  assert.doesNotThrow(() =>
    assertCorsResponse(ok, ORIGIN, 'GET', ['if-match']));
});

test('CORS preflight refuses wildcard origin, missing headers or wrong method', () => {
  for (const [headers, method, required] of [
    [{ 'access-control-allow-origin': '*',
      'access-control-allow-methods': 'PUT',
      'access-control-allow-headers': 'content-type, if-none-match' },
    'PUT', ['content-type', 'if-none-match']],
    [{ 'access-control-allow-origin': ORIGIN,
      'access-control-allow-methods': 'GET',
      'access-control-allow-headers': 'content-type, if-none-match' },
    'PUT', ['content-type', 'if-none-match']],
    [{ 'access-control-allow-origin': ORIGIN,
      'access-control-allow-methods': 'PUT',
      'access-control-allow-headers': 'content-type' },
    'PUT', ['content-type', 'if-none-match']],
  ]) {
    assert.throws(() => assertCorsResponse(
      response(headers), ORIGIN, method, required,
    ), /r2-cors-/);
  }
});

test('CORS preflight requires HTTP success even with permissive headers', () => {
  assert.throws(() => assertCorsResponse(response({
    'access-control-allow-origin': ORIGIN,
    'access-control-allow-methods': 'PUT',
    'access-control-allow-headers': 'content-type, if-none-match',
  }, 403), ORIGIN, 'PUT', ['content-type', 'if-none-match']),
  /r2-cors-preflight-status/);
});
