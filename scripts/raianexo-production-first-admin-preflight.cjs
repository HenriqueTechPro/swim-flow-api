#!/usr/bin/env node
'use strict';

// Read-only production inspection BEFORE invoking the existing guarded bootstrap.
// No email, tokens, connection URLs or credentials are printed.
const { assertProductionBootstrapTarget } = require('./bootstrap-production-first-admin.cjs');
const { EXPECTED_MIGRATIONS } = require('./neon-production-target.cjs');

const OPERATIONS = Object.freeze(['inspect', 'apply', 'resend', 'retarget']);
function assertOperation(value) {
  if (!OPERATIONS.includes(value)) throw new Error('Unknown production first-admin operation.');
  return value;
}

function validateState(state, actualMigrations, operation) {
  assertOperation(operation);
  if (!state || !Array.isArray(actualMigrations)) {
    throw new Error('Incomplete production admin preflight.');
  }
  for (const key of ['profiles', 'admins', 'identities', 'sessions', 'pending']) {
    if (!Number.isSafeInteger(state[key]) || state[key] < 0) {
      throw new Error('Invalid production admin preflight count.');
    }
  }
  if (JSON.stringify(actualMigrations) !== JSON.stringify(EXPECTED_MIGRATIONS)) {
    throw new Error('Production Prisma migrations do not match the reviewed set.');
  }
  if (operation === 'apply' &&
      (state.profiles !== 0 || state.admins !== 0 ||
       state.identities !== 0 || state.sessions !== 0 || state.pending !== 0)) {
    throw new Error('Production is not empty: first administrator creation refused. Review pending invitation before retrying.');
  }
  if ((operation === 'resend' || operation === 'retarget') &&
      (state.profiles !== 1 || state.admins !== 1 ||
       state.identities !== 1 || state.sessions !== 0 || state.pending !== 1)) {
    throw new Error('Production does not have exactly one pending first admin: resend refused.');
  }
  return true;
}

async function inspectProduction(prisma, operation, env) {
  assertOperation(operation);
  // The validation intentionally performs URL/target checks for ALL operations
  // even for inspect; it never invokes a mutating bootstrap here.
  assertProductionBootstrapTarget(env, ['--' + ((operation === 'resend' || operation === 'retarget') ? 'resend' : 'apply')]);

  const [counts, migrations] = await Promise.all([
    prisma.$queryRaw`SELECT
      (SELECT COUNT(*)::int FROM public.profiles) AS profiles,
      (SELECT COUNT(*)::int FROM public.profiles WHERE role = 'admin') AS admins,
      (SELECT COUNT(*)::int FROM public.local_auth_identities) AS identities,
      (SELECT COUNT(*)::int FROM public.auth_sessions) AS sessions,
      (SELECT COUNT(*)::int FROM public.local_auth_identities
        WHERE email_confirmed_at IS NULL AND password_hash IS NULL AND disabled_at IS NULL) AS pending`,
    prisma.$queryRaw`SELECT migration_name FROM public._prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      ORDER BY migration_name`,
  ]);
  if (!Array.isArray(counts) || counts.length !== 1 || !Array.isArray(migrations)) {
    throw new Error('Unexpected Neon inspection result.');
  }
  const state = counts[0];
  const names = migrations.map((entry) => entry.migration_name);
  validateState(state, names, operation);
  // Only counts, never personal data or credentials.
  process.stdout.write(
    'RaiaNexo production verified: ' + names.length + ' migrations, ' +
    state.profiles + ' profiles, ' + state.admins + ' admins, ' +
    state.identities + ' login identities, ' + state.sessions + ' sessions.\\n',
  );
}

async function main() {
  const operation = assertOperation(process.argv[2]);
  if (process.argv.length !== 3) throw new Error('Exactly one operation required.');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ log: [] });
  try { await inspectProduction(prisma, operation, process.env); }
  finally { await prisma.$disconnect(); }
}

if (require.main === module) {
  main().catch(() => {
    process.stderr.write('RaiaNexo production admin preflight failed; no changes applied.\\n');
    process.exitCode = 1;
  });
}

module.exports = { OPERATIONS, assertOperation, validateState, inspectProduction };
