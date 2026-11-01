#!/usr/bin/env node
'use strict';

/**
 * LOCAL/EXPLICIT ONLY. Requires a Vercel CLI-linked LAB project and OIDC
 * injected by "vercel env run -e preview -- ...". No Render, Neon, user photos
 * or GitHub secrets. Never print a token, object URL or synthetic object path.
 */
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const {
  assertDisposableOidcSmoke, LAB_STORE_ID,
} = require('./private-blob-oidc-smoke-guard.cjs');

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+p6n0AAAAASUVORK5CYII=',
  'base64',
);
const WRONG_ETAG = '"00000000000000000000000000000000"';

function check(ok, reason) {
  if (!ok) throw new Error('blob-oidc-' + reason);
}
function linkedProject() {
  try {
    return JSON.parse(fs.readFileSync(
      path.join(process.cwd(), '.vercel', 'project.json'), 'utf8'));
  } catch {
    throw new Error('blob-oidc-lab-project-link-required');
  }
}
function requirePrivateUrl(url, key) {
  const parsed = new URL(url);
  const host = LAB_STORE_ID.slice('store_'.length).toLowerCase() +
    '.private.blob.vercel-storage.com';
  check(parsed.protocol === 'https:' && parsed.hostname === host &&
    parsed.pathname === '/' + key && !parsed.search && !parsed.hash &&
    !parsed.username && !parsed.password, 'private-host-or-path-mismatch');
}

async function boundedBytes(stream) {
  const chunks = [];
  let total = 0;
  for await (const chunk of stream) {
    total += chunk.length;
    check(total <= 1024, 'unexpected-response-size');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function run() {
  assertDisposableOidcSmoke(process.env, process.argv.slice(2), linkedProject());
  // Only import network-capable SDK AFTER the guard has verified project,
  // throwaway store and short-lived OIDC. No static RW token is passed.
  const { put, head, get, del, BlobNotFoundError } = require('@vercel/blob');
  const key = 'private/profiles/' + randomUUID() + '/' + randomUUID() + '.png';
  const stat = async () => {
    try { return await head(key); }
    catch (error) {
      if (error instanceof BlobNotFoundError) return null;
      throw error;
    }
  };

  let attemptedPut = false;
  let etag = null;
  let completed = false;
  try {
    check(await stat() === null, 'synthetic-path-not-empty');
    attemptedPut = true;
    const result = await put(key, PNG, {
      access: 'private', contentType: 'image/png',
      addRandomSuffix: false, allowOverwrite: false,
      cacheControlMaxAge: 60,
    });
    etag = result.etag;
    requirePrivateUrl(result.url, key);
    check(result.pathname === key && result.contentType === 'image/png' &&
      typeof etag === 'string' && etag.length > 2, 'upload-receipt-invalid');
    const remote = await stat();
    check(remote && remote.etag === etag &&
      remote.size === PNG.length && remote.contentType === 'image/png',
    'head-metadata-mismatch');
    requirePrivateUrl(remote.url, key);

    const anon = await fetch(remote.url, {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(12000),
    });
    await anon.arrayBuffer();
    check([401, 403, 404].includes(anon.status), 'anonymous-read-allowed');

    const obtained = await get(key, {
      access: 'private', useCache: false, headers: { 'If-Match': etag },
    });
    check(obtained && obtained.statusCode === 200 && obtained.stream &&
      obtained.blob.etag === etag &&
      obtained.blob.size === PNG.length, 'private-read-invalid');
    requirePrivateUrl(obtained.blob.url, key);
    check((await boundedBytes(obtained.stream)).equals(PNG),
      'private-bytes-differ');

    let rejectedOverwrite = false;
    try {
      await put(key, PNG, { access: 'private', contentType: 'image/png',
        addRandomSuffix: false, allowOverwrite: false });
    } catch { rejectedOverwrite = true; }
    check(rejectedOverwrite, 'overwrite-allowed');

    let rejectedWrongEtag = false;
    try { await del(key, { ifMatch: WRONG_ETAG }); }
    catch { rejectedWrongEtag = true; }
    check(rejectedWrongEtag, 'wrong-etag-delete-allowed');
    check((await stat())?.etag === etag, 'wrong-etag-changed-object');

    await del(key, { ifMatch: etag });
    check(await stat() === null, 'deleted-object-still-present');
    completed = true;
    process.stdout.write(
      'PASS: disposable Blob OIDC: private PUT/HEAD/GET, anonymous denied, ' +
      'no overwrite, ETag-conditional DELETE, no residue.\n');
  } finally {
    if (attemptedPut && !completed) {
      if (!etag) {
        process.stderr.write(
          'SMOKE_ORPHAN_REVIEW_REQUIRED: inspect the lab store privately.\n');
        throw new Error('blob-oidc-unverified-upload-may-exist');
      }
      try {
        const current = await stat();
        if (current) {
          check(current.etag === etag, 'cleanup-version-conflict');
          await del(key, { ifMatch: etag });
          check(await stat() === null, 'cleanup-not-confirmed');
        }
      } catch {
        process.stderr.write(
          'SMOKE_CLEANUP_FAILED: inspect only this run in the lab.\n');
        throw new Error('blob-oidc-cleanup-failed');
      }
    }
  }
}

if (require.main === module) {
  run().catch(error => {
    const safe = /^blob-oidc-[a-z-]+$/.test(error?.message || '')
      ? error.message : 'blob-oidc-failed-review-privately';
    process.stderr.write('FAIL: ' + safe + '\n');
    process.exitCode = 1;
  });
}
module.exports = { requirePrivateUrl, linkedProject };
