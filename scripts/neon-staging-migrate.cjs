#!/usr/bin/env node
'use strict';

/**
 * ONE-TIME initial Prisma baseline for Swim Flow's explicitly named Neon
 * STAGING database. Requires an affirmative flag and acknowledgement.
 * No automatic execution in CI, build, startup or Render deploy.
 */
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { readFileSync, readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { checkNeonEnvironment } = require('./neon-preflight.cjs');
const { inspectNeonDatabase } = require('./neon-inspect.cjs');

const ROOT = resolve(__dirname, '..');
const INITIAL_MIGRATION = '20261020000000_init_neon';
const EXPECTED_BLOB = 'a400e1c412e875cc33a766939c1dfcb5b8ccb8bb';
const STAGING = Object.freeze({
  projectId: 'raspy-breeze-33258358',
  branchId: 'br-gentle-wildflower-b7qrnd74',
  database: 'swimflow',
  directHost: 'ep-old-lake-b7qha3a0.c-13.us-east-1.aws.neon.tech',
  pooledHost: 'ep-old-lake-b7qha3a0-pooler.c-13.us-east-1.aws.neon.tech',
  acknowledgement: 'APPLY_SWIM_FLOW_STAGING_BASELINE',
});

function validateTarget(env, args) {
  // Neither a missing flag nor a CI noninteractive launch can write.
  if (args.length !== 1 || args[0] !== '--apply') {
    throw new Error('Explicit --apply argument required; no migration attempted.');
  }
  if (env.SWIMFLOW_NEON_STAGING_APPROVAL !== STAGING.acknowledgement) {
    throw new Error('Explicit staging migration approval is required.');
  }
  if (env.NEON_PROJECT_ID !== STAGING.projectId ||
      env.NEON_BRANCH_ID !== STAGING.branchId) {
    throw new Error('Neon project and branch must match the approved staging destination.');
  }
  checkNeonEnvironment(env);
  const direct = new URL(env.DIRECT_URL);
  const pooled = new URL(env.DATABASE_URL);
  if (direct.hostname !== STAGING.directHost ||
      pooled.hostname !== STAGING.pooledHost ||
      decodeURIComponent(direct.pathname.slice(1)) !== STAGING.database ||
      decodeURIComponent(pooled.pathname.slice(1)) !== STAGING.database) {
    throw new Error('Neon connection host or database does not match staging.');
  }
  return true;
}

function verifyFrozenBaseline(root = ROOT) {
  const migrationDirs = readdirSync(resolve(root, 'prisma/migrations'), { withFileTypes: true })
    .filter((dir) => dir.isDirectory() && /^\d{14}_/.test(dir.name))
    .map((dir) => dir.name);
  if (migrationDirs.length !== 1 || migrationDirs[0] !== INITIAL_MIGRATION) {
    throw new Error('Unexpected migration inventory; this command is initial baseline only.');
  }
  const bytes = readFileSync(resolve(root, 'prisma/migrations', INITIAL_MIGRATION, 'migration.sql'));
  const blob = createHash('sha1')
    .update(Buffer.from('blob ' + bytes.length + '\0'))
    .update(bytes)
    .digest('hex');
  if (blob !== EXPECTED_BLOB) {
    throw new Error('Initial migration differs from the reviewed immutable baseline.');
  }
  return true;
}

function runNode(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT, env: process.env, encoding: 'utf8',
    maxBuffer: 12 * 1024 * 1024, timeout: 240000,
  });
  // Deliberately do NOT relay Prisma stdout/stderr (which may include
  // database hostnames, identities, passwords or error diagnostics).
  if (result.error || result.status !== 0) {
    throw new Error('Prisma migration step failed; inspect privately before retrying.');
  }
}

function assertPostMigration(row) {
  if (!row || Number(row.application_tables) !== 32 ||
      Number(row.application_enums) !== 25 ||
      Number(row.applied_baseline) !== 1 ||
      Number(row.total_migrations) !== 1) {
    throw new Error('Unexpected post-migration schema or Prisma history; investigate privately.');
  }
  return { applicationTables: 32, applicationEnums: 25, prismaMigrations: 1 };
}

const POST_MIGRATION_QUERY = `
SELECT
  (SELECT COUNT(*)::integer FROM pg_catalog.pg_class c
   JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname='public' AND c.relkind IN ('r','p')
     AND c.relname <> '_prisma_migrations') AS application_tables,
  (SELECT COUNT(*)::integer FROM pg_catalog.pg_type t
   JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
   WHERE n.nspname='public' AND t.typtype='e') AS application_enums,
  (SELECT COUNT(*)::integer FROM public._prisma_migrations
   WHERE migration_name='20261020000000_init_neon'
     AND finished_at IS NOT NULL AND rolled_back_at IS NULL) AS applied_baseline,
  (SELECT COUNT(*)::integer FROM public._prisma_migrations) AS total_migrations
`;

async function executeStagingMigration(env, args, deps) {
  validateTarget(env, args);
  // The SQL is versioned, immutable and reviewed. No data write occurs until
  // all four checks below succeed.
  deps.verifyFrozenBaseline();
  deps.checkBaselineGenerated();
  const snapshot = await deps.inspect();
  if (!snapshot?.candidateEmpty || snapshot.userRelations !== 0 ||
      snapshot.userEnums !== 0 || snapshot.hasPrismaMigrationTable !== false ||
      snapshot.direct !== 'connected' || snapshot.pooled !== 'connected') {
    throw new Error('Staging database is not verified empty; migration refused.');
  }

  deps.migrate();
  const result = assertPostMigration(await deps.verify());
  deps.migrationStatus();
  return result;
}

async function main() {
  try {
    const { PrismaClient } = require('@prisma/client');
    const createClient = (url) => new PrismaClient({
      datasources: { db: { url } }, log: [],
    });
    const result = await executeStagingMigration(process.env, process.argv.slice(2), {
      verifyFrozenBaseline,
      checkBaselineGenerated: () => runNode([resolve(ROOT, 'scripts/create-neon-baseline.cjs'), '--check']),
      inspect: () => inspectNeonDatabase(process.env, createClient),
      migrate: () => runNode([
        resolve(ROOT, 'node_modules/prisma/build/index.js'),
        'migrate', 'deploy', '--schema', resolve(ROOT, 'prisma/schema.prisma'),
      ]),
      verify: async () => {
        const prisma = createClient(process.env.DIRECT_URL);
        try {
          const rows = await prisma.$queryRawUnsafe(POST_MIGRATION_QUERY);
          return Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
        } finally {
          await prisma.$disconnect().catch(() => undefined);
        }
      },
      migrationStatus: () => runNode([
        resolve(ROOT, 'node_modules/prisma/build/index.js'),
        'migrate', 'status', '--schema', resolve(ROOT, 'prisma/schema.prisma'),
      ]),
    });
    process.stdout.write('Staging Prisma baseline deployed and verified.\n');
    process.stdout.write(JSON.stringify(result) + '\n');
  } catch {
    // Do not leak Prisma error data, URLs or secrets from the terminal.
    process.stderr.write(
      'Staging migration blocked or failed. Do not retry until you verify the DB schema and Prisma history.\n',
    );
    process.exitCode = 1;
  }
}
if (require.main === module) void main();

module.exports = {
  validateTarget, verifyFrozenBaseline, assertPostMigration,
  executeStagingMigration, POST_MIGRATION_QUERY, STAGING,
};
