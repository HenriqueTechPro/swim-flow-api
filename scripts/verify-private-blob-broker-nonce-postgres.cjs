#!/usr/bin/env node
'use strict';

/**
 * Real PostgreSQL concurrency proof for the future private Blob broker.
 * CI service container ONLY. Never Neon, Render, Vercel, real user data.
 * Creates and drops one isolated regular table so competing Prisma
 * connections see the SAME unique constraint (unlike session temp tables).
 *
 * This script MUST run in database-quality.yml after schema diff checks.
 */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createAtomicPostgresNonceClaim } = require('./private-blob-broker-postgres-nonce.cjs');

const TABLE = 'public.private_blob_broker_nonce_claims';
const PREFIX = 'swim-flow-blob-staging-broker-v1:';
// Fixed, non-sensitive stage names for CI diagnostics (never reveal SQL/errors).
let phase = 'guard';

function assertCiDisposable(env) {
  if (
    env.SWIMFLOW_DISPOSABLE_DB !== 'yes' ||
    env.CI !== 'true' ||
    env.GITHUB_ACTIONS !== 'true' ||
    env.GITHUB_WORKFLOW !== 'PostgreSQL baseline quality gate' ||
    env.GITHUB_REPOSITORY !== 'HenriqueTechPro/swim-flow-api' ||
    env.NODE_ENV === 'production'
  ) {
    throw new Error('broker-postgres-ci-disposable-approval-required');
  }

  for (const name of ['DATABASE_URL', 'DIRECT_URL']) {
    let url;
    try { url = new URL(env[name]); } catch {
      throw new Error('broker-postgres-ci-nonlocal-database-refused');
    }
    if (
      url.protocol !== 'postgresql:' ||
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      url.port !== '5432' ||
      url.pathname !== '/swimflow' ||
      url.username !== 'ci' ||
      url.password !== 'ci' ||
      url.hash ||
      url.search !== '?schema=public'
    ) throw new Error('broker-postgres-ci-nonlocal-database-refused');
  }
}

function makeQuery(prisma) {
  return async (sql, values) => {
    // The SQL is a static constant from the nonce adapter. Values are bound
    // via Prisma query parameters, never interpolated into SQL.
    const rows = await prisma.$queryRawUnsafe(sql, ...values);
    return { rows, rowCount: rows.length };
  };
}

async function run(env = process.env) {
  // Validate BEFORE loading Prisma or establishing any DB connection.
  phase = 'guard';
  assertCiDisposable(env);
  phase = 'prisma';
  const { PrismaClient } = require('@prisma/client');
  const first = new PrismaClient({ log: [] });
  const second = new PrismaClient({ log: [] });
  let created = false;

  try {
    // Refuse to modify an existing table, even in a disposable CI database.
    phase = 'preexisting-table-check';
    const existing = await first.$queryRawUnsafe(
      "SELECT to_regclass('public.private_blob_broker_nonce_claims') AS existing",
    );
    assert.equal(existing[0]?.existing, null, 'CI nonce table unexpectedly exists');

    phase = 'create-table';
    await first.$executeRawUnsafe([
      'CREATE TABLE ' + TABLE + ' (',
      ' nonce_key TEXT PRIMARY KEY,',
      ' expires_at TIMESTAMPTZ NOT NULL,',
      ' created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),',
      ' CONSTRAINT private_blob_broker_nonce_prefix',
      " CHECK (nonce_key LIKE 'swim-flow-blob-staging-broker-v1:%')",
      ')',
    ].join(''));
    created = true;

    const claimA = createAtomicPostgresNonceClaim(makeQuery(first));
    const claimB = createAtomicPostgresNonceClaim(makeQuery(second));
    const key = PREFIX + randomUUID();
    const expiresAtMs = Date.now() + 31_000;

    // Competing requests through separate Prisma clients/connection pools:
    // exactly one INSERT succeeds for a nonce even with concurrent requests.
    phase = 'concurrency';
    const attempts = await Promise.all(
      Array.from({ length: 24 }, (_, i) =>
        (i % 2 ? claimA : claimB)(key, expiresAtMs),
      ),
    );
    assert.equal(attempts.filter(Boolean).length, 1);
    assert.equal(attempts.filter(value => value === false).length, 23);

    assert.equal(await claimA(key, expiresAtMs), false);
    assert.equal(await claimB(key, expiresAtMs + 1000), false);

    // Different nonces remain independent and valid.
    phase = 'independent-nonce';
    const anotherKey = PREFIX + randomUUID();
    assert.equal(await claimB(anotherKey, expiresAtMs), true);
    assert.equal(await claimA(anotherKey, expiresAtMs), false);

    // Invalid identifiers or expirations cannot produce an INSERT.
    assert.equal(await claimA('private/students/secret', expiresAtMs), false);
    assert.equal(await claimA(PREFIX + randomUUID(), Number.NaN), false);

    // SQL-level uniqueness and retention timestamp; no process-local Set.
    phase = 'inspect-retention';
    const rows = await second.$queryRawUnsafe(
      'SELECT nonce_key, expires_at FROM ' + TABLE + ' ORDER BY nonce_key',
    );
    assert.equal(rows.length, 2);
    assert(rows.every(row => row.expires_at instanceof Date));
    assert(rows.every(row => row.expires_at.getTime() === expiresAtMs));
    assert(rows.some(row => row.nonce_key === key));
    assert(rows.some(row => row.nonce_key === anotherKey));

    process.stdout.write(
      'PASS: disposable PostgreSQL broker nonce claims, concurrent replay denial and retention. No live Blob calls.\n',
    );
  } finally {
    let cleanupFailure;
    if (created) {
      try { await first.$executeRawUnsafe('DROP TABLE ' + TABLE); } catch {
        cleanupFailure = new Error('broker-postgres-ci-cleanup-failed');
      }
    }
    await Promise.allSettled([first.$disconnect(), second.$disconnect()]);
    if (cleanupFailure) throw cleanupFailure;
  }
}

if (require.main === module) {
  void run().catch(() => {
    // Never expose DB URL, credentials, SQL exception or nonce values.
    process.stderr.write('FAIL: disposable broker nonce PostgreSQL verification [' + phase + ']\n');
    process.exitCode = 1;
  });
}

module.exports = { assertCiDisposable, run };
