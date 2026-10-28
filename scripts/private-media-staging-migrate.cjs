#!/usr/bin/env node
'use strict';

/**
 * 02F-06B3G5 — incremental PRIVATE-MEDIA schema only, Neon STAGING only.
 * --check is offline; --apply requires protected workflow + typed approval.
 * No row deletes, no data import, no Blob service flags, no production deploy.
 */
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const { checkNeonEnvironment } = require('./neon-preflight.cjs');
const {
  STAGING,
  verifyVersionedMigrations,
} = require('./neon-local-auth-staging.cjs');

const ROOT = resolve(__dirname, '..');
const BASELINE = Object.freeze([
  '20261020000000_init_neon',
  '20261021000000_local_auth_identity_foundation',
]);
const PRIVATE_MEDIA = Object.freeze([
  '20261025000000_private_media_object_metadata',
  '20261025010000_private_media_verified_etag',
  '20261025020000_private_blob_binding_lifecycle',
  '20261026000000_private_blob_cleanup_claim',
  '20261026010000_private_blob_cleanup_completion',
]);
const APPROVAL = 'APPLY_ONLY_PRIVATE_MEDIA_MIGRATIONS_TO_NEON_STAGING';
const STATUS_SQL = `
SELECT current_database() AS database_name,
       (to_regclass('public.private_media_objects') IS NOT NULL) AS media_objects,
       (to_regclass('public.private_media_active_bindings') IS NOT NULL) AS active_bindings,
       (to_regclass('public.local_auth_identities') IS NOT NULL) AS local_auth,
       (to_regclass('public.students') IS NOT NULL) AS students,
       (to_regclass('public.teachers') IS NOT NULL) AS teachers,
       (to_regclass('public.parents') IS NOT NULL) AS parents
`;
const HISTORY_SQL = `
SELECT migration_name, checksum,
       (finished_at IS NOT NULL AND rolled_back_at IS NULL) AS applied
FROM public._prisma_migrations
ORDER BY migration_name
`;

function fileChecksum(name, root = ROOT) {
  const path = resolve(root, 'prisma', 'migrations', name, 'migration.sql');
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function assertHistory(rows, expected, root = ROOT) {
  if (!Array.isArray(rows) || rows.length !== expected.length) {
    throw new Error('Unexpected Prisma migration history length');
  }
  const found = new Map();
  for (const row of rows) {
    if (!row || typeof row.migration_name !== 'string' ||
        found.has(row.migration_name) || row.applied !== true ||
        typeof row.checksum !== 'string') {
      throw new Error('Unfinished, duplicate or invalid Prisma migration history');
    }
    found.set(row.migration_name, row.checksum);
  }
  for (const name of expected) {
    if (found.get(name) !== fileChecksum(name, root)) {
      throw new Error('Prisma database checksum differs from reviewed migration');
    }
  }
  return true;
}

function assertSnapshot(snapshot, phase, root = ROOT) {
  if (!snapshot || !snapshot.schema ||
      !snapshot.schema.local_auth || !snapshot.schema.students ||
      !snapshot.schema.teachers || !snapshot.schema.parents ||
      snapshot.schema.database_name !== STAGING.database) {
    throw new Error('Unexpected Neon staging schema or database');
  }
  const complete = phase === 'after';
  if (snapshot.schema.media_objects !== complete ||
      snapshot.schema.active_bindings !== complete) {
    throw new Error('Unexpected private media table state');
  }
  assertHistory(snapshot.history,
    complete ? [...BASELINE, ...PRIVATE_MEDIA] : BASELINE, root);
  return true;
}

function assertTarget(env, args) {
  if (args.length !== 1 || args[0] !== '--apply' ||
      env.SWIMFLOW_PRIVATE_STAGING_MIGRATION_APPROVAL !== APPROVAL ||
      env.NEON_PROJECT_ID !== STAGING.projectId ||
      env.NEON_BRANCH_ID !== STAGING.branchId ||
      env.NODE_ENV === 'production' ||
      env.SWIMFLOW_PRIVATE_BLOB_ENABLED === 'true' ||
      env.SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED === 'true' ||
      env.SWIMFLOW_R2_STORAGE_ENABLED === 'true' ||
      (env.GITHUB_REPOSITORY && env.GITHUB_REPOSITORY !== 'HenriqueTechPro/swim-flow-api') ||
      (env.GITHUB_REF && env.GITHUB_REF !== 'refs/heads/main')) {
    throw new Error('Explicit isolated Neon staging migration authorization required');
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
    throw new Error('Staging host, database or schema differs from approved Neon project');
  }
  return true;
}

async function execute(env, args, deps) {
  deps.verifyVersionedMigrations();
  if (args.length === 1 && args[0] === '--check') {
    return { approvedMigrations: PRIVATE_MEDIA.length, writes: false };
  }
  assertTarget(env, args);
  const before = await deps.inspect();
  assertSnapshot(before, 'before', deps.root || ROOT);
  // No migration execution until BOTH the exact DB state and local checksums pass.
  await deps.migrate();
  const after = await deps.inspect();
  assertSnapshot(after, 'after', deps.root || ROOT);
  await deps.status();
  return { approvedMigrations: PRIVATE_MEDIA.length, verified: true };
}

async function inspect(client) {
  const [schemaRows, history] = await Promise.all([
    client.$queryRawUnsafe(STATUS_SQL),
    client.$queryRawUnsafe(HISTORY_SQL),
  ]);
  if (!Array.isArray(schemaRows) || schemaRows.length !== 1) {
    throw new Error('Staging database schema query returned unexpected rows');
  }
  return { schema: schemaRows[0], history };
}

function runPrisma(command) {
  const proc = spawnSync(process.execPath, [
    resolve(ROOT, 'node_modules/prisma/build/index.js'),
    'migrate', command, '--schema', resolve(ROOT, 'prisma/schema.prisma'),
  ], {
    cwd: ROOT,
    env: process.env,
    encoding: 'utf8',
    timeout: 240000,
    maxBuffer: 4 * 1024 * 1024,
  });
  // Never print raw Prisma output or errors: they can include private DB URLs.
  if (proc.error || proc.status !== 0) {
    throw new Error('Prisma migration command failed; review staging privately');
  }
}

async function main() {
  try {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === '--check') {
      await execute(process.env, args, { verifyVersionedMigrations });
      process.stdout.write('PASS: five reviewed private-media SQL migrations pinned offline. No DB access.\n');
      return;
    }
    // Authorize before initializing a DB client, reading URLs or migrating.
    assertTarget(process.env, args);
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient({
      datasources: { db: { url: process.env.DIRECT_URL } }, log: [],
    });
    try {
      await execute(process.env, args, {
        verifyVersionedMigrations,
        inspect: () => inspect(prisma),
        migrate: () => runPrisma('deploy'),
        status: () => runPrisma('status'),
      });
      process.stdout.write('PASS: exact five private-media migrations applied and verified on dedicated Neon staging.\n');
    } finally {
      await prisma.$disconnect().catch(() => undefined);
    }
  } catch {
    process.stderr.write(
      'BLOCKED: private-media staging migration preflight or verification failed. No automatic retry. Inspect only the staging environment privately.\n',
    );
    process.exitCode = 1;
  }
}

if (require.main === module) void main();
module.exports = {
  APPROVAL, BASELINE, PRIVATE_MEDIA, STAGING,
  STATUS_SQL, HISTORY_SQL, fileChecksum, assertHistory,
  assertSnapshot, assertTarget, execute, inspect,
};
