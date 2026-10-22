#!/usr/bin/env node
'use strict';

/**
 * One-time bridge between GitHub Environment secrets and the original
 * bootstrap-first-admin.cjs (which deliberately accepts passwords only on
 * stdin). No user-controlled password reaches argv, stdout, or the child env.
 * Running this file directly still requires all staging approvals/URLs.
 */
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');
const { assertStagingTarget, validateAdminInput, STAGING } = require('./bootstrap-first-admin.cjs');
const { checkNeonEnvironment } = require('./neon-preflight.cjs');

const REQUIRED_SECRET_KEYS = Object.freeze([
  'SWIMFLOW_STAGING_FIRST_ADMIN_EMAIL',
  'SWIMFLOW_STAGING_FIRST_ADMIN_NAME',
  'SWIMFLOW_STAGING_FIRST_ADMIN_PASSWORD',
]);

function prepareStagingBootstrap(env, args) {
  // Fail closed before touching a database or launching another process.
  assertStagingTarget(env, args);
  checkNeonEnvironment(env);
  if (new URL(env.DIRECT_URL).searchParams.get('schema') !== 'public' ||
      new URL(env.DATABASE_URL).searchParams.get('schema') !== 'public') {
    throw new Error('Both staging database URLs must target schema=public.');
  }
  for (const key of REQUIRED_SECRET_KEYS) {
    if (typeof env[key] !== 'string' || !env[key].length) {
      throw new Error('Required protected environment secret not configured.');
    }
  }
  const validated = validateAdminInput({
    email: env.SWIMFLOW_STAGING_FIRST_ADMIN_EMAIL,
    fullName: env.SWIMFLOW_STAGING_FIRST_ADMIN_NAME,
    password: env.SWIMFLOW_STAGING_FIRST_ADMIN_PASSWORD,
  });

  const childEnv = {
    ...env,
    SWIMFLOW_BOOTSTRAP_ADMIN_EMAIL: validated.email,
    SWIMFLOW_BOOTSTRAP_ADMIN_NAME: validated.fullName,
  };
  // The child only reads its password from stdin, never its environment.
  // Also remove any accidentally provided aliases for secret input.
  for (const key of REQUIRED_SECRET_KEYS) delete childEnv[key];
  delete childEnv.SWIMFLOW_BOOTSTRAP_ADMIN_PASSWORD;

  return {
    childEnv,
    input: Buffer.from(validated.password + '\n', 'utf8'),
  };
}

function runStagingBootstrap(env, args, invoke = spawnSync) {
  const { childEnv, input } = prepareStagingBootstrap(env, args);
  try {
    const result = invoke(process.execPath, [
      resolve(__dirname, 'bootstrap-first-admin.cjs'), '--apply',
    ], {
      env: childEnv,
      cwd: resolve(__dirname, '..'),
      input,
      encoding: 'utf8',
      timeout: 90000,
      maxBuffer: 65536,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (result.error || result.status !== 0 || result.signal) {
      // Never forward raw child stdout/stderr, even on unexpected failure.
      throw new Error('One-time staging admin bootstrap did not complete.');
    }
    return { success: true };
  } finally {
    input.fill(0); // Best-effort wipe of byte buffer after child exits.
  }
}

if (require.main === module) {
  try {
    runStagingBootstrap(process.env, process.argv.slice(2));
    process.stdout.write('Staging first administrator provisioned. Check the Neon database by read-only query.\n');
  } catch {
    process.stderr.write('Staging first-admin bootstrap refused or failed. Verify safe target, secrets, and empty database before investigating.\n');
    process.exitCode = 1;
  }
}

module.exports = { prepareStagingBootstrap, runStagingBootstrap, STAGING, REQUIRED_SECRET_KEYS };
