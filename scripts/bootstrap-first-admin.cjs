#!/usr/bin/env node
'use strict';
const { randomUUID } = require('node:crypto');
const { readSync } = require('node:fs');

const STAGING = Object.freeze({
  projectId: 'raspy-breeze-33258358',
  branchId: 'br-gentle-wildflower-b7qrnd74',
  database: 'swimflow',
  directHost: 'ep-old-lake-b7qha3a0.c-13.us-east-1.aws.neon.tech',
  pooledHost: 'ep-old-lake-b7qha3a0-pooler.c-13.us-east-1.aws.neon.tech',
  approval: 'BOOTSTRAP_SWIM_FLOW_STAGING_ADMIN_ONCE',
});
const FOUNDATION = '20261021000000_local_auth_identity_foundation';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function assertStagingTarget(env, args) {
  if (args.length !== 1 || args[0] !== '--apply')
    throw new Error('Explicit --apply required.');
  if (env.SWIMFLOW_BOOTSTRAP_ADMIN_APPROVAL !== STAGING.approval)
    throw new Error('Explicit staging admin approval required.');
  if (env.NEON_PROJECT_ID !== STAGING.projectId || env.NEON_BRANCH_ID !== STAGING.branchId)
    throw new Error('Neon staging project/branch mismatch.');
  let direct, pooled;
  try {
    direct = new URL(env.DIRECT_URL);
    pooled = new URL(env.DATABASE_URL);
  } catch {
    throw new Error('Both Neon connection URLs are required.');
  }
  for (const [url, host] of [[direct, STAGING.directHost], [pooled, STAGING.pooledHost]]) {
    if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
        url.hostname !== host ||
        decodeURIComponent(url.pathname.slice(1)) !== STAGING.database ||
        !url.username || !url.password)
      throw new Error('Neon staging target mismatch.');
  }
  return direct.toString();
}

function validateAdminInput({ email, fullName, password }) {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const normalizedName = typeof fullName === 'string' ? fullName.trim() : '';
  if (normalizedEmail.length > 320 || !EMAIL_PATTERN.test(normalizedEmail))
    throw new Error('Invalid admin email.');
  if (normalizedName.length < 2 || normalizedName.length > 160)
    throw new Error('Admin name must have 2 to 160 characters.');
  if (typeof password !== 'string' || /[\r\n\0]/.test(password) ||
      Buffer.byteLength(password, 'utf8') < 12 ||
      Buffer.byteLength(password, 'utf8') > 72)
    throw new Error('Password must have 12 to 72 UTF-8 bytes, one line.');
  return { email: normalizedEmail, fullName: normalizedName, password };
}

function readPasswordFromStdin(fd = 0) {
  const chunks = [];
  let size = 0;
  while (true) {
    const buf = Buffer.alloc(128);
    const length = readSync(fd, buf, 0, buf.length, null);
    if (!length) break;
    size += length;
    if (size > 256) throw new Error('Password input too long.');
    chunks.push(buf.subarray(0, length));
  }
  const input = Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
  if (/[\r\n]/.test(input)) throw new Error('Password must be one line.');
  return input;
}

async function bootstrapFirstAdmin(prisma, input, options = {}) {
  const { email, fullName, password } = validateAdminInput(input);
  const hashPassword = options.hashPassword || (async (value) => {
    const { hash } = require('bcryptjs');
    return hash(value, 12);
  });
  const passwordHash = await hashPassword(password);
  const id = (options.generateId || randomUUID)();

  return prisma.$transaction(async (tx) => {
    // Advisory lock serializes simultaneous bootstrap attempts.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(2026102108::bigint)::text AS held`;
    const migrations = await tx.$queryRaw`
      SELECT migration_name FROM "_prisma_migrations"
      WHERE migration_name = '20261021000000_local_auth_identity_foundation'
        AND finished_at IS NOT NULL AND rolled_back_at IS NULL
    `;
    if (!Array.isArray(migrations) || migrations.length !== 1 ||
        migrations[0].migration_name !== FOUNDATION)
      throw new Error('The identity migration must be applied before bootstrap.');
    const profiles = await tx.profile.count();
    const identities = await tx.localAuthIdentity.count();
    const sessions = await tx.authSession.count();
    if (profiles !== 0 || identities !== 0 || sessions !== 0)
      throw new Error('Bootstrap denied: identities or sessions already exist.');
    const created = await tx.profile.create({
      data: {
        id,
        fullName,
        role: 'admin',
        localAuthIdentity: { create: { email, passwordHash, emailConfirmedAt: new Date() } },
      },
      select: { id: true },
    });
    return { id: created.id, email };
  }, { isolationLevel: 'ReadCommitted', maxWait: 10000, timeout: 20000 });
}

async function main() {
  let prisma;
  try {
    const url = assertStagingTarget(process.env, process.argv.slice(2));
    if (process.stdin.isTTY)
      throw new Error('Password must be piped through stdin.');
    const password = readPasswordFromStdin();
    const input = {
      email: process.env.SWIMFLOW_BOOTSTRAP_ADMIN_EMAIL,
      fullName: process.env.SWIMFLOW_BOOTSTRAP_ADMIN_NAME,
      password,
    };
    validateAdminInput(input);
    const { PrismaClient } = require('@prisma/client');
    prisma = new PrismaClient({ datasources: { db: { url } }, log: [] });
    const result = await bootstrapFirstAdmin(prisma, input);
    process.stdout.write('Staging administrator provisioned: ' + result.id + '\n');
  } catch {
    // Never print passwords, database URLs or raw Prisma errors.
    process.stderr.write('Bootstrap refused. Check staging target, migration and empty database privately.\n');
    process.exitCode = 1;
  } finally {
    if (prisma) await prisma.$disconnect();
  }
}

module.exports = {
  STAGING, assertStagingTarget, validateAdminInput, readPasswordFromStdin, bootstrapFirstAdmin,
};
if (require.main === module) void main();
