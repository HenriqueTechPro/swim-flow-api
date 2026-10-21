#!/usr/bin/env node
'use strict';

/**
 * Safe Neon migration preflight. No migrations or writes are performed here.
 *
 * --check   Validate the two connection URLs locally; NO network traffic.
 * --connect In addition, use DIRECT_URL for one read-only catalog query.
 *
 * Connection strings, passwords and Prisma error messages are never logged.
 */
const NEON_SUFFIX = '.neon.tech';
const EMPTY_SCHEMA_SQL = [
  'SELECT table_name FROM information_schema.tables',
  "WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'",
  'ORDER BY table_name',
].join(' ');

function invalid(label, reason) {
  throw new Error(label + ': ' + reason);
}

function parseConnection(label, raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    invalid(label, 'connection string not configured');
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    invalid(label, 'invalid PostgreSQL URL');
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    invalid(label, 'PostgreSQL protocol required');
  }
  if (!url.hostname.toLowerCase().endsWith(NEON_SUFFIX)) {
    invalid(label, 'expected a Neon endpoint (not a legacy or local database)');
  }
  if (!url.username || !url.password) {
    invalid(label, 'database credentials missing');
  }
  if (url.port && url.port !== '5432') {
    invalid(label, 'unexpected PostgreSQL port');
  }
  const name = url.pathname.slice(1);
  if (!name || name.includes('/') || /^(?:postgres|template0|template1)$/i.test(name)) {
    invalid(label, 'a dedicated application database is required');
  }
  const sslMode = url.searchParams.get('sslmode');
  if (!['require', 'verify-full'].includes(sslMode)) {
    invalid(label, 'TLS is required (sslmode=require or verify-full)');
  }
  const schema = url.searchParams.get('schema');
  if (schema !== null && schema !== 'public') {
    invalid(label, 'only the reviewed public schema may be migrated');
  }
  return url;
}

function checkNeonConfiguration(environment) {
  const pooled = parseConnection('DATABASE_URL', environment.DATABASE_URL);
  const direct = parseConnection('DIRECT_URL', environment.DIRECT_URL);
  const isPooled = (host) => host.split('.')[0].endsWith('-pooler');
  if (!isPooled(pooled.hostname)) {
    invalid('DATABASE_URL', 'runtime URL must use a Neon pooled endpoint');
  }
  if (isPooled(direct.hostname)) {
    invalid('DIRECT_URL', 'migration URL must use a non-pooled Neon endpoint');
  }
  const unpooledHost = pooled.hostname.replace(/-pooler(?=\.)/, '');
  if (unpooledHost !== direct.hostname) {
    throw new Error('Neon URLs point to different endpoints/projects');
  }
  if (pooled.username !== direct.username || pooled.pathname !== direct.pathname) {
    throw new Error('Neon URLs must target the same database and user');
  }
  // Never return any URL or secret from the public result.
  return { valid: true, provider: 'neon-postgresql', tls: true, sameDatabase: true };
}

async function inspectEmptyNeonDatabase(database) {
  let rows;
  try {
    // Static SQL only, with no interpolated user input or data modifications.
    rows = await database.$queryRawUnsafe(EMPTY_SCHEMA_SQL);
  } catch {
    throw new Error('Unable to verify Neon schema via a read-only query; no changes made');
  }
  if (!Array.isArray(rows)) {
    throw new Error('Unexpected catalog response; no changes made');
  }
  if (rows.length > 0) {
    throw new Error('Neon target has existing tables; refusing initial baseline migration');
  }
  return { empty: true };
}

async function run(argv, environment = process.env, createDatabase) {
  if (argv.length > 1 || (argv[0] && !['--check', '--connect'].includes(argv[0]))) {
    throw new Error('Usage: node scripts/neon-preflight.cjs [--check|--connect]');
  }
  checkNeonConfiguration(environment);
  process.stdout.write('Neon URL pairing, TLS and schema configuration: OK (secrets hidden).\n');

  if (argv[0] !== '--connect') {
    process.stdout.write('Offline-only preflight passed; no database was contacted.\n');
    return;
  }
  // A network connection requires an explicit --connect action by the operator.
  const factory = createDatabase || ((url) => {
    const { PrismaClient } = require('@prisma/client');
    return new PrismaClient({ datasources: { db: { url } } });
  });
  let client;
  try {
    client = factory(environment.DIRECT_URL);
  } catch {
    throw new Error('Unable to initialize read-only Neon inspection; no changes made');
  }
  try {
    await inspectEmptyNeonDatabase(client);
    process.stdout.write('Read-only database check: empty schema confirmed.\n');
  } finally {
    try {
      await client.$disconnect();
    } catch {
      // Never expose network/client errors that may contain credentials.
    }
  }
}

if (require.main === module) {
  run(process.argv.slice(2)).catch((error) => {
    // Our own errors are static and contain no URL, credentials or hostnames.
    process.stderr.write('Neon preflight failed: ' + error.message + '\n');
    process.exitCode = 1;
  });
}
module.exports = { parseConnection, checkNeonConfiguration, inspectEmptyNeonDatabase, run };
