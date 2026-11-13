#!/usr/bin/env node
'use strict';

// Reviewed, one-time migration of exactly two existing Prisma migrations.
// Run only by the dedicated, protected GitHub Actions workflow on a named
// staging-only ops branch. Database credentials are never logged.
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const { checkNeonEnvironment } = require('./neon-preflight.cjs');
const {
  STAGING,
  verifyVersionedMigrations,
} = require('./neon-local-auth-staging.cjs');

const ROOT = resolve(__dirname, '..');
const BRANCH = 'refs/heads/ops/neon-staging-student-report-20261113';
const CONFIRMATION = 'APPLY_STUDENT_REPORT_TO_NEON_STAGING';
const PRIOR_MIGRATION = '20261108000000_teacher_cref_registration';
const EXPECTED_NEW = Object.freeze([
  '20261108130000_complete_swimming_category_catalog',
  '20261113120000_student_progress_report_observations',
]);
const PREVIOUS_COUNT = 10;
const TARGET_COUNT = 12;
const PREVIOUS_TABLES = 39;
const TARGET_TABLES = 40;

const STATUS_SQL = [
  'SELECT current_database() AS database_name,',
  ' (SELECT count(*) FROM information_schema.tables WHERE',
  " table_schema='public' AND table_type='BASE TABLE'",
  " AND table_name <> '_prisma_migrations') AS application_tables,",
  ' (SELECT count(*) FROM public.categories) AS categories,',
  " (to_regclass('public.student_progress_report_observations') IS NOT NULL) AS has_observations,",
  ' (SELECT count(*) FROM public.students) AS students,',
  ' (SELECT count(*) FROM public.anthropometric_assessments) AS assessments,',
  ' (SELECT count(*) FROM public.attendance_records) AS attendance,',
  ' (SELECT count(*) FROM pg_constraint WHERE conrelid =',
  " to_regclass('public.student_progress_report_observations') AND contype = 'f') AS observation_foreign_keys",
].join('\n');
const HISTORY_SQL = [
  'SELECT migration_name, checksum,',
  ' (finished_at IS NOT NULL AND rolled_back_at IS NULL) AS applied',
  ' FROM public._prisma_migrations ORDER BY migration_name',
].join('\n');

function assertEnvironment(env) {
  if (env.GITHUB_REPOSITORY !== 'HenriqueTechPro/swim-flow-api' ||
      env.GITHUB_REF !== BRANCH ||
      env.GITHUB_EVENT_NAME !== 'push' ||
      env.NODE_ENV !== 'test' ||
      env.SWIMFLOW_STUDENT_REPORT_STAGING_APPROVAL !== CONFIRMATION ||
      env.NEON_PROJECT_ID !== STAGING.projectId ||
      env.NEON_BRANCH_ID !== STAGING.branchId) {
    throw new Error('Only the exact protected staging migration workflow is authorized');
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
    throw new Error('Neon staging host, database or schema mismatch');
  }
}

function checkedChecksum(name) {
  return createHash('sha256')
    .update(readFileSync(resolve(ROOT, 'prisma/migrations', name, 'migration.sql')))
    .digest('hex');
}

function assertHistory(rows, count, after) {
  if (!Array.isArray(rows) || rows.length !== count) {
    throw new Error('Unexpected Prisma migration inventory');
  }
  if (rows.some((row) => row.applied !== true ||
      typeof row.checksum !== 'string' ||
      row.checksum !== checkedChecksum(row.migration_name))) {
    throw new Error('Unfinished or unreviewed Prisma migration found');
  }
  const names = rows.map((row) => row.migration_name);
  if (new Set(names).size !== names.length ||
      !names.includes(PRIOR_MIGRATION)) {
    throw new Error('Expected existing migration history not found');
  }
  for (const name of EXPECTED_NEW) {
    if (names.includes(name) !== after) {
      throw new Error('Unexpected state of pending report migrations');
    }
  }
}

function assertSnapshot(snapshot, after) {
  const s = snapshot.row;
  const targetTables = after ? TARGET_TABLES : PREVIOUS_TABLES;
  const targetCount = after ? TARGET_COUNT : PREVIOUS_COUNT;
  if (!s || s.database_name !== STAGING.database ||
      Number(s.application_tables) !== targetTables ||
      Number(s.categories) !== 28 ||
      Boolean(s.has_observations) !== after ||
      Number(s.observation_foreign_keys) !== (after ? 4 : 0)) {
    throw new Error('Unexpected staging schema; refusing migration or success');
  }
  assertHistory(snapshot.history, targetCount, after);
}

async function inspect(prisma) {
  const [rows, history] = await Promise.all([
    prisma.$queryRawUnsafe(STATUS_SQL),
    prisma.$queryRawUnsafe(HISTORY_SQL),
  ]);
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error('Unexpected staging inspection response');
  }
  return { row: rows[0], history };
}

function runPrisma(command) {
  const result = spawnSync(process.execPath, [
    resolve(ROOT, 'node_modules/prisma/build/index.js'),
    'migrate', command, '--schema', resolve(ROOT, 'prisma/schema.prisma'),
  ], { cwd: ROOT, env: process.env, encoding: 'utf8',
    maxBuffer: 2 * 1024 * 1024, timeout: 240000 });
  if (result.error || result.status !== 0) {
    throw new Error('Prisma migrate ' + command + ' failed; inspect the staging ledger before any retry');
  }
}

async function run() {
  if (process.argv.length === 3 && process.argv[2] === '--check') {
    verifyVersionedMigrations();
    process.stdout.write('Reviewed migration bytes match: offline check passed.\n');
    return;
  }
  if (process.argv.length !== 3 || process.argv[2] !== '--apply') {
    throw new Error('Use exactly --check or --apply');
  }
  assertEnvironment(process.env);
  verifyVersionedMigrations();
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DIRECT_URL } },
    log: [],
  });
  let before;
  try {
    before = await inspect(prisma);
    assertSnapshot(before, false);
    process.stdout.write('Preflight passed: 10 migrations, 39 tables, unchanged category catalog.\n');
  } finally {
    await prisma.$disconnect();
  }

  // Crucial: Prisma writes SQL AND the official _prisma_migrations ledger.
  // No manual ALTER or fabricated ledger entries are ever used.
  runPrisma('deploy');

  const verifyPrisma = new PrismaClient({
    datasources: { db: { url: process.env.DIRECT_URL } },
    log: [],
  });
  try {
    const after = await inspect(verifyPrisma);
    assertSnapshot(after, true);
    for (const key of ['students', 'assessments', 'attendance']) {
      if (Number(after.row[key]) < Number(before.row[key])) {
        throw new Error('Unexpected lower row count after migration: ' + key);
      }
    }
  } finally {
    await verifyPrisma.$disconnect();
  }
  runPrisma('status');
  process.stdout.write(
    'SUCCESS: exactly two Prisma migrations applied to Neon staging, 12 total, 40 tables, 4 report FKs; historical records preserved.\n',
  );
}

if (require.main === module) run().catch(() => {
  // Deliberately do not expose database URLs or Prisma exception details.
  process.stderr.write(
    'BLOCKED: Neon staging report migration verification failed. Do not retry automatically; inspect migration state first.\n',
  );
  process.exitCode = 1;
});

module.exports = { assertEnvironment, assertHistory, assertSnapshot, STATUS_SQL, HISTORY_SQL };
