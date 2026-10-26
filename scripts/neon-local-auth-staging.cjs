#!/usr/bin/env node
'use strict';

/**
 * Incremental Prisma 6 migration for the dedicated Neon STAGING database.
 * Never invoked by build, startup, tests, deploy hooks or Render Blueprint.
 * Real database writes require --apply and a separate human opt-in value.
 */
const { createHash } = require('node:crypto');
const { readdirSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const { checkNeonEnvironment } = require('./neon-preflight.cjs');

const ROOT = resolve(__dirname, '..');
const EXPECTED = Object.freeze({
  '20261020000000_init_neon': 'e98a2c3c9940e55344fc39c7a551979c7b2b20362783e2ddf44ab01b40fc3e80',
  '20261021000000_local_auth_identity_foundation': '7a010c592b4c30b6d2e8a609ccd593c8bea262e98371fa2e99d3211a26f046a5',
});
// New migrations must be reviewed and pinned individually. The former
// first-local-auth bootstrap runner remains retired for all apply operations.
const ADDITIONAL_MIGRATION_BLOBS = Object.freeze({
  '20261025000000_private_media_object_metadata': '18443faa28d55ee13eec99bc3bda472e6e5822d8',
  '20261025010000_private_media_verified_etag': '90514b5e7b7fc9f76eee8f747012d8eed02ba8ab',
  '20261025020000_private_blob_binding_lifecycle': 'b814ec47156693ecc5282a60a71394aa20b34217',
});
const HISTORICAL_MIGRATIONS = Object.keys(EXPECTED).length;
const APPROVED_MIGRATIONS = HISTORICAL_MIGRATIONS +
  Object.keys(ADDITIONAL_MIGRATION_BLOBS).length;

const STAGING = Object.freeze({
  projectId: 'raspy-breeze-33258358',
  branchId: 'br-gentle-wildflower-b7qrnd74',
  database: 'swimflow',
  directHost: 'ep-old-lake-b7qha3a0.c-13.us-east-1.aws.neon.tech',
  pooledHost: 'ep-old-lake-b7qha3a0-pooler.c-13.us-east-1.aws.neon.tech',
  approval: 'APPLY_SWIM_FLOW_LOCAL_AUTH_STAGING',
});

function verifyVersionedMigrations(root = ROOT) {
  const dir = resolve(root, 'prisma', 'migrations');
  const names = readdirSync(dir, { withFileTypes: true })
    .filter((file) => file.isDirectory() && /^\d{14}_/.test(file.name))
    .map((file) => file.name).sort();
  if (JSON.stringify(names) !== JSON.stringify([
    ...Object.keys(EXPECTED), ...Object.keys(ADDITIONAL_MIGRATION_BLOBS),
  ].sort())) {
    throw new Error('Unexpected migration inventory');
  }
  for (const [name, checksum] of Object.entries(EXPECTED)) {
    const data = readFileSync(resolve(dir, name, 'migration.sql'));
    if (createHash('sha256').update(data).digest('hex') !== checksum) {
      throw new Error('Versioned migration checksum mismatch');
    }
  }
  // Git blob SHA-1 pins the exact bytes of the new, reviewed migration.
  // Historical migrations remain pinned by their existing SHA-256 digests.
  for (const [name, expectedBlob] of Object.entries(ADDITIONAL_MIGRATION_BLOBS)) {
    const data = readFileSync(resolve(dir, name, 'migration.sql'));
    const blob = createHash('sha1')
      .update(Buffer.from('blob ' + data.length + '\0'))
      .update(data)
      .digest('hex');
    if (blob !== expectedBlob) {
      throw new Error('Additional migration checksum mismatch');
    }
  }
  return true;
}

function validateApplyTarget(env, args) {
  if (args.length !== 1 || args[0] !== '--apply') {
    throw new Error('Explicit --apply required');
  }
  if (env.SWIMFLOW_LOCAL_AUTH_STAGING_APPROVAL !== STAGING.approval ||
    env.NEON_PROJECT_ID !== STAGING.projectId ||
    env.NEON_BRANCH_ID !== STAGING.branchId) {
    throw new Error('Staging destination approval is missing or invalid');
  }
  checkNeonEnvironment(env);
  const direct = new URL(env.DIRECT_URL);
  const pooled = new URL(env.DATABASE_URL);
  if (direct.hostname !== STAGING.directHost ||
    pooled.hostname !== STAGING.pooledHost ||
    decodeURIComponent(direct.pathname.slice(1)) !== STAGING.database ||
    decodeURIComponent(pooled.pathname.slice(1)) !== STAGING.database ||
    direct.searchParams.get('schema') !== 'public' ||
    pooled.searchParams.get('schema') !== 'public') {
    throw new Error('Staging connection does not match approved project and schema');
  }
  return true;
}

function assertBefore(snapshot) {
  if (!snapshot || snapshot.database_name !== STAGING.database ||
    Number(snapshot.application_tables) !== 31 ||
    Number(snapshot.migrations) !== 1 ||
    Number(snapshot.baseline_ok) !== 1 ||
    Number(snapshot.identities_present) !== 0 ||
    Number(snapshot.tokens_present) !== 0 ||
    Number(snapshot.profiles) !== 0 ||
    Number(snapshot.sessions) !== 0) {
    throw new Error('Pre-migration database state is not the approved empty staging baseline');
  }
  return true;
}

function assertAfter(snapshot) {
  if (!snapshot || snapshot.database_name !== STAGING.database ||
    Number(snapshot.application_tables) !== 33 ||
    Number(snapshot.migrations) !== 2 ||
    Number(snapshot.local_migration_ok) !== 1 ||
    Number(snapshot.identity_rows) !== 0 ||
    Number(snapshot.token_rows) !== 0 ||
    Number(snapshot.local_constraints) !== 9) {
    throw new Error('Post-migration Prisma history/schema differs from the expected state');
  }
  return true;
}

const BASELINE_SQL = `
SELECT current_database() AS database_name,
  (SELECT count(*) FROM pg_catalog.pg_tables
   WHERE schemaname='public' AND tablename <> '_prisma_migrations') AS application_tables,
  (SELECT count(*) FROM public._prisma_migrations) AS migrations,
  (SELECT count(*) FROM public._prisma_migrations WHERE
   migration_name='20261020000000_init_neon'
   AND checksum='e98a2c3c9940e55344fc39c7a551979c7b2b20362783e2ddf44ab01b40fc3e80'
   AND finished_at IS NOT NULL AND rolled_back_at IS NULL) AS baseline_ok,
  (SELECT (to_regclass('public.local_auth_identities') IS NOT NULL)::integer) AS identities_present,
  (SELECT (to_regclass('public.local_auth_action_tokens') IS NOT NULL)::integer) AS tokens_present,
  (SELECT count(*) FROM public.profiles) AS profiles,
  (SELECT count(*) FROM public.auth_sessions) AS sessions
`;

const AFTER_SQL = `
SELECT current_database() AS database_name,
  (SELECT count(*) FROM pg_catalog.pg_tables
   WHERE schemaname='public' AND tablename <> '_prisma_migrations') AS application_tables,
  (SELECT count(*) FROM public._prisma_migrations) AS migrations,
  (SELECT count(*) FROM public._prisma_migrations WHERE
   migration_name='20261021000000_local_auth_identity_foundation'
   AND checksum='7a010c592b4c30b6d2e8a609ccd593c8bea262e98371fa2e99d3211a26f046a5'
   AND finished_at IS NOT NULL AND rolled_back_at IS NULL) AS local_migration_ok,
  (SELECT count(*) FROM public.local_auth_identities) AS identity_rows,
  (SELECT count(*) FROM public.local_auth_action_tokens) AS token_rows,
  (SELECT count(*) FROM pg_catalog.pg_constraint
   WHERE connamespace='public'::regnamespace
   AND conname LIKE 'local_auth%') AS local_constraints
`;

function runPrisma(args) {
  const result = spawnSync(process.execPath, [
    resolve(ROOT, 'node_modules/prisma/build/index.js'),
    ...args,
    '--schema',
    resolve(ROOT, 'prisma/schema.prisma'),
  ], { cwd: ROOT, env: process.env, encoding: 'utf8', timeout: 240000,
    maxBuffer: 4 * 1024 * 1024 });
  // Prisma can include sensitive connection details in its output.
  if (result.error || result.status !== 0) {
    throw new Error('Prisma CLI operation failed: inspect in a private terminal');
  }
}

async function execute(env, args, deps) {
  verifyVersionedMigrations(deps.root || ROOT);
  if (args.length === 1 && args[0] === '--check') {
    // Offline-only check; safe in CI without secrets.
    return { verifiedFiles: APPROVED_MIGRATIONS, wroteDatabase: false };
  }
  // This script was a ONE-TIME local-identity migration for an EMPTY Neon
  // staging database. It must never silently deploy new private-media
  // migrations or write over the now-live administrator's data.
  if (APPROVED_MIGRATIONS > HISTORICAL_MIGRATIONS) {
    throw new Error('One-time local-auth migration runner is retired');
  }
  validateApplyTarget(env, args);
  const before = await deps.inspectBefore();
  assertBefore(before);
  deps.migrate();
  const after = await deps.inspectAfter();
  assertAfter(after);
  deps.status();
  return { verifiedFiles: 2, applicationTables: 33, migrationCount: 2 };
}

async function main() {
  try {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === '--check') {
      await execute(process.env, args, { root: ROOT });
      process.stdout.write('Versioned historical and new migration files verified offline; no database connection.\n');
      return;
    }
    // Do not instantiate Prisma until all flag and destination checks succeed.
    validateApplyTarget(process.env, args);
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } }, log: [] });
    try {
      const result = await execute(process.env, args, {
        inspectBefore: async () => (await prisma.$queryRawUnsafe(BASELINE_SQL))[0],
        inspectAfter: async () => (await prisma.$queryRawUnsafe(AFTER_SQL))[0],
        migrate: () => runPrisma(['migrate', 'deploy']),
        status: () => runPrisma(['migrate', 'status']),
      });
      process.stdout.write('Staging incremental Prisma migration validated.\n');
      process.stdout.write(JSON.stringify(result) + '\n');
    } finally {
      await prisma.$disconnect().catch(() => undefined);
    }
  } catch {
    process.stderr.write('Staging migration refused or failed. Stop and privately inspect schema/history; do not retry blindly.\n');
    process.exitCode = 1;
  }
}
if (require.main === module) void main();

module.exports = {
  verifyVersionedMigrations, validateApplyTarget, assertBefore, assertAfter,
  execute, BASELINE_SQL, AFTER_SQL, STAGING,
};
