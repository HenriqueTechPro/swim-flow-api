#!/usr/bin/env node
'use strict';

/**
 * Pure configuration preflight. NO database is contacted, NO migration runs,
 * and no connection string or credential is ever printed.
 */
function inspectDatabaseUrl(raw, label, shouldPool) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error(label + ' is required.');
  }
  let url;
  try { url = new URL(raw); } catch { throw new Error(label + ' is not a valid URL.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error(label + ' must use PostgreSQL.');
  }
  if (!url.hostname.toLowerCase().endsWith('.neon.tech')) {
    throw new Error(label + ' must target a Neon hostname.');
  }
  if (!url.username || !url.password || url.pathname.length <= 1) {
    throw new Error(label + ' requires database, username and password.');
  }
  const isPool = /-pooler\./i.test(url.hostname);
  if (shouldPool !== isPool) {
    throw new Error(label + (shouldPool ? ' must use the pooled Neon host.' : ' must use the direct Neon host.'));
  }
  if (!['require', 'verify-full', 'verify-ca'].includes(url.searchParams.get('sslmode'))) {
    throw new Error(label + ' must explicitly require TLS (sslmode=require or stronger).');
  }
  return { hostname: url.hostname.toLowerCase(), database: decodeURIComponent(url.pathname.slice(1)) };
}

function checkNeonEnvironment(env) {
  const pooled = inspectDatabaseUrl(env.DATABASE_URL, 'DATABASE_URL', true);
  const direct = inspectDatabaseUrl(env.DIRECT_URL, 'DIRECT_URL', false);
  if (pooled.database !== direct.database) {
    throw new Error('DATABASE_URL and DIRECT_URL must target the same database.');
  }
  if (pooled.hostname.replace(/-pooler\./i, '.') !== direct.hostname) {
    throw new Error('Pooled and direct URLs must use the same Neon endpoint.');
  }
  return true;
}

if (require.main === module) {
  try {
    checkNeonEnvironment(process.env);
    process.stdout.write('Neon configuration preflight passed (no connection attempted).\n');
  } catch (error) {
    // Never interpolate connection URLs or the original parsing error.
    process.stderr.write('Neon configuration preflight failed: ' + error.message + '\n');
    process.exitCode = 1;
  }
}

module.exports = { inspectDatabaseUrl, checkNeonEnvironment };
