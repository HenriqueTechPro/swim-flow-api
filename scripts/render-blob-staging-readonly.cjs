#!/usr/bin/env node
'use strict';

/**
 * Never invoked by CI/deploy. --check = offline configuration classification,
 * --execute = explicit staging-only synthetic HEAD, no uploads or deletes.
 *
 * The OIDC token from the Vercel lab cannot be used in Render. A real
 * staging-store-specific RW credential is required for this *alternate*
 * transport. A credential is NOT proof of authorization to see a swimmer.
 */
const { randomUUID } = require('node:crypto');
const {
  STAGING_STORE_ID, classify, assertRenderBlobStagingReadOnly,
} = require('./render-blob-staging-readonly-guard.cjs');

function safeStatus(error) {
  // Never emit SDK error message or response, token, blob URL/path, headers.
  const status = error?.statusCode ?? error?.status ?? error?.response?.status;
  if (Number.isInteger(status) && [400, 401, 403, 404, 409, 429, 500, 502, 503, 504].includes(status)) {
    return 'render-blob-readonly-http-' + status;
  }
  return 'render-blob-readonly-sdk-or-network-error';
}

async function main(args, env, sdk) {
  if (args.length === 1 && args[0] === '--check') {
    const state = classify(env);
    process.stdout.write(
      (state === 'ready-for-manual-readonly-probe' ? 'READY_FOR_READONLY_PROBE: ' : 'BLOCKED: ') +
      state + '\n',
    );
    return state === 'ready-for-manual-readonly-probe' ? 0 : 2;
  }
  const { token } = assertRenderBlobStagingReadOnly(env, args);
  const { head, BlobNotFoundError } = sdk || require('@vercel/blob');
  const key = 'private/profiles/' + randomUUID() + '/' + randomUUID() + '.png';
  try {
    const response = await head(key, {
      token,
      abortSignal: AbortSignal.timeout(12000),
    });
    // A random synthetic key must not exist in an empty staging store.
    if (response) throw new Error('render-blob-synthetic-key-unexpectedly-found');
    throw new Error('render-blob-synthetic-key-unexpected-response');
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      process.stdout.write(
        'PASS: Render staging-specific static RW credential completed synthetic HEAD (404). No write performed.\n',
      );
      return 0;
    }
    if (/^render-blob-[a-z-]+$/.test(error?.message || '')) throw error;
    throw new Error(safeStatus(error));
  }
}

if (require.main === module) {
  main(process.argv.slice(2), process.env).then(
    (code) => { process.exitCode = code; },
    (error) => {
      const message = /^render-blob-[a-z-]+(?:-http-[0-9]{3})?$/.test(error?.message || '')
        ? error.message : 'render-blob-readonly-failed-review-privately';
      process.stderr.write('FAIL: ' + message + '\n');
      process.exitCode = 1;
    },
  );
}

module.exports = { main, safeStatus };
