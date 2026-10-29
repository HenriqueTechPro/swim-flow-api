#!/usr/bin/env node
'use strict';

/**
 * 02F-06B3G6: read-only Neon STAGING private-media readiness audit.
 * Unlike the separate schema deployment workflow, NEVER calls migrate/deploy,
 * never enables Blob, never queries user rows, and cannot modify PostgreSQL.
 */
const { resolve } = require('node:path');
const { checkNeonEnvironment } = require('./neon-preflight.cjs');
const { verifyVersionedMigrations } = require('./neon-local-auth-staging.cjs');
const { STAGING, assertSnapshot, inspect } = require('./private-media-staging-migrate.cjs');

const ROOT = resolve(__dirname, '..');

function assertAuditTarget(env, args) {
  if (args.length !== 1 || args[0] !== '--audit' ||
      env.NEON_PROJECT_ID !== STAGING.projectId ||
      env.NEON_BRANCH_ID !== STAGING.branchId ||
      env.NODE_ENV === 'production' ||
      env.SWIMFLOW_PRIVATE_BLOB_ENABLED === 'true' ||
      env.SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED === 'true' ||
      env.SWIMFLOW_R2_STORAGE_ENABLED === 'true' ||
      (env.GITHUB_REPOSITORY && env.GITHUB_REPOSITORY !== 'HenriqueTechPro/swim-flow-api') ||
      (env.GITHUB_REF && env.GITHUB_REF !== 'refs/heads/main')) {
    throw new Error('Neon private-media read-only audit is restricted to staging');
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
    throw new Error('Neon audit refused: host or schema is not the approved staging database');
  }
  return true;
}

function classifySnapshot(snapshot, root = ROOT) {
  try {
    assertSnapshot(snapshot, 'before', root);
    return 'PENDING';
  } catch {}
  try {
    assertSnapshot(snapshot, 'after', root);
    return 'READY';
  } catch {}
  return 'DRIFT';
}

async function audit(client) {
  // The PostgreSQL engine itself guarantees read-only behavior, even if
  // the inspected application helper is changed in the future.
  const result = await client.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    return classifySnapshot(await inspect(tx));
  }, { isolationLevel: 'RepeatableRead', maxWait: 5000, timeout: 10000 });
  if (result === 'DRIFT') {
    throw new Error('Unexpected migration or schema state; no writes were attempted');
  }
  return result;
}

async function execute(env, args, deps) {
  deps.verifyVersionedMigrations();
  if (args.length === 1 && args[0] === '--check') {
    return { mode: 'offline', writes: false };
  }
  assertAuditTarget(env, args);
  const classification = await deps.audit();
  if (classification !== 'PENDING' && classification !== 'READY') {
    throw new Error('Staging status is not safe to proceed');
  }
  return { mode: 'read-only', classification, writes: false };
}

async function main() {
  try {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === '--check') {
      await execute(process.env, args, { verifyVersionedMigrations });
      process.stdout.write('PASS: offline readiness audit verified seven pinned migrations (no database access).\n');
      return;
    }
    // Reject unsafe destinations BEFORE even constructing the DB client.
    assertAuditTarget(process.env, args);
    const { PrismaClient } = require('@prisma/client');
    const client = new PrismaClient({
      datasources: { db: { url: process.env.DIRECT_URL } }, log: [],
    });
    try {
      const result = await execute(process.env, args, {
        verifyVersionedMigrations,
        audit: () => audit(client),
      });
      process.stdout.write(result.classification === 'PENDING'
        ? 'PENDING: exactly five private-media migrations remain. No writes performed.\n'
        : 'READY: all seven migrations and both private-media tables verified. No writes performed.\n');
    } finally {
      await client.$disconnect().catch(() => undefined);
    }
  } catch {
    // Do not print SQL errors, hosts, tokens, usernames, or connection strings.
    process.stderr.write(
      'BLOCKED: Neon staging readiness could not be verified. Review privately; no changes were made.\n',
    );
    process.exitCode = 1;
  }
}

if (require.main === module) void main();

module.exports = { assertAuditTarget, classifySnapshot, audit, execute };
