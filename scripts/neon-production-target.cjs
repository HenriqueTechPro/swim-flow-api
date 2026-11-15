#!/usr/bin/env node
'use strict';

// Production database bootstrap guard. This script never connects to PostgreSQL,
// changes data, or prints connection URLs, usernames, passwords, or tokens.
const { readdirSync } = require('node:fs');
const { resolve } = require('node:path');

const TARGET = Object.freeze({
  projectId: 'round-bonus-30138797',
  branchId: 'br-tiny-mud-bb79ybtx',
  database: 'swimflow',
  directHost: 'ep-broad-wildflower-bb1fuesv.c-15.us-east-1.aws.neon.tech',
  pooledHost: 'ep-broad-wildflower-bb1fuesv-pooler.c-15.us-east-1.aws.neon.tech',
  acknowledgement: 'APPLY_SWIM_FLOW_EMPTY_PRODUCTION_SCHEMA',
});

const EXPECTED_MIGRATIONS = Object.freeze([
  '20261020000000_init_neon',
  '20261021000000_local_auth_identity_foundation',
  '20261025000000_private_media_object_metadata',
  '20261025010000_private_media_verified_etag',
  '20261025020000_private_blob_binding_lifecycle',
  '20261026000000_private_blob_cleanup_claim',
  '20261026010000_private_blob_cleanup_completion',
  '20261106000000_competition_program_separated_identity',
  '20261106170000_results_program_optional_links',
  '20261108000000_teacher_cref_registration',
  '20261108130000_complete_swimming_category_catalog',
  '20261113120000_student_progress_report_observations',
]);

function verifyMigrationSet(root = resolve(__dirname, '..')) {
  const actual = readdirSync(resolve(root, 'prisma/migrations'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (actual.length !== EXPECTED_MIGRATIONS.length ||
      actual.some((item, index) => item !== EXPECTED_MIGRATIONS[index])) {
    throw new Error('Production baseline migration set changed; re-review before applying.');
  }
  return actual.length;
}

function parseUrl(value, label, expectedHost) {
  let url;
  try { url = new URL(value); } catch { throw new Error(label + ' is missing or malformed.'); }
  if (!['postgresql:', 'postgres:'].includes(url.protocol) ||
      url.hostname.toLowerCase() !== expectedHost ||
      decodeURIComponent(url.pathname.slice(1)) !== TARGET.database ||
      !url.username || !url.password ||
      url.searchParams.get('sslmode') !== 'require' ||
      url.hash || url.searchParams.has('options')) {
    throw new Error(label + ' does not match the approved Neon production destination.');
  }
  return decodeURIComponent(url.username);
}

function verifyProductionTarget(env) {
  if (env.NEON_PROJECT_ID !== TARGET.projectId ||
      env.NEON_BRANCH_ID !== TARGET.branchId ||
      env.SWIMFLOW_PRODUCTION_MIGRATION_APPROVAL !== TARGET.acknowledgement) {
    throw new Error('Explicit Neon production project, branch and approval are required.');
  }
  const directRole = parseUrl(env.DIRECT_URL, 'DIRECT_URL', TARGET.directHost);
  const pooledRole = parseUrl(env.DATABASE_URL, 'DATABASE_URL', TARGET.pooledHost);
  if (directRole !== pooledRole) {
    throw new Error('Direct and pooled connection roles must match.');
  }
  return true;
}

if (require.main === module) {
  try {
    if (process.argv.length !== 3 || !['--check', '--verify-env'].includes(process.argv[2])) {
      throw new Error('Use --check (offline) or --verify-env (configuration only).');
    }
    const count = verifyMigrationSet();
    if (process.argv[2] === '--verify-env') verifyProductionTarget(process.env);
    process.stdout.write('PASS: ' + count + ' reviewed migrations and approved production guard.\n');
  } catch (error) {
    process.stderr.write('FAIL: ' + error.message + '\n');
    process.exitCode = 1;
  }
}
module.exports = { TARGET, EXPECTED_MIGRATIONS, verifyMigrationSet, verifyProductionTarget };
