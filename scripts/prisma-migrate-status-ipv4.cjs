'use strict';

const { lookup } = require('node:dns').promises;
const { existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = resolve(__dirname, '..');

async function main() {
  if (process.argv.length !== 2) {
    throw new Error('This command accepts no arguments and only runs migrate status.');
  }

  const envFile = resolve(ROOT, '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  if (!process.env.DATABASE_URL || !process.env.DIRECT_URL) {
    throw new Error('Configure DATABASE_URL and DIRECT_URL before checking migration status.');
  }

  let direct;
  try {
    direct = new URL(process.env.DIRECT_URL);
  } catch {
    throw new Error('DIRECT_URL must be a valid PostgreSQL URL.');
  }
  if (!['postgres:', 'postgresql:'].includes(direct.protocol) ||
      !direct.hostname.endsWith('.neon.tech') ||
      /-pooler\./i.test(direct.hostname) ||
      direct.searchParams.get('sslmode') !== 'require') {
    throw new Error('This workaround requires a direct Neon URL with sslmode=require.');
  }
  if (direct.searchParams.has('options')) {
    throw new Error('DIRECT_URL already contains options; review them before using this workaround.');
  }

  const endpoint = direct.hostname.split('.')[0];
  let address;
  try {
    ({ address } = await lookup(direct.hostname, { family: 4 }));
  } catch {
    throw new Error('Could not resolve the Neon endpoint to an IPv4 address.');
  }

  // Resolve on every run; never persist a potentially stale address in .env.
  // Neon uses the endpoint startup option to route connections made by IP.
  direct.hostname = address;
  direct.searchParams.set('options', 'endpoint=' + endpoint);
  if (!direct.searchParams.has('connect_timeout')) {
    direct.searchParams.set('connect_timeout', '15');
  }

  console.log('Checking migration status over IPv4; no migrations will be applied.');
  const result = spawnSync(process.execPath, [
    resolve(ROOT, 'node_modules/prisma/build/index.js'),
    'migrate', 'status', '--schema', resolve(ROOT, 'prisma/schema.prisma'),
  ], {
    cwd: ROOT,
    env: { ...process.env, DIRECT_URL: direct.toString() },
    stdio: 'inherit',
    timeout: 60000,
  });
  if (result.error || result.signal || result.status === null) {
    throw new Error('The Prisma status process failed or timed out.');
  }
  process.exitCode = result.status;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
