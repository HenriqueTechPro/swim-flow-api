#!/usr/bin/env node
'use strict';

const { randomUUID, randomBytes, createHash } = require('node:crypto');

const STAGING = Object.freeze({
  projectId: 'raspy-breeze-33258358',
  branchId: 'br-gentle-wildflower-b7qrnd74',
  database: 'swimflow',
  directHost: 'ep-old-lake-b7qha3a0.c-13.us-east-1.aws.neon.tech',
  pooledHost: 'ep-old-lake-b7qha3a0-pooler.c-13.us-east-1.aws.neon.tech',
  approval: 'BOOTSTRAP_SWIM_FLOW_STAGING_ADMIN_ONCE',
});
const FOUNDATION = '20261021000000_local_auth_identity_foundation';
const INVITATION_LIFETIME_MS = 24 * 60 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function assertStagingTarget(env, args) {
  if (args.length !== 1 || !['--apply', '--resend'].includes(args[0])) {
    throw new Error('Explicit --apply or --resend required.');
  }
  if (env.SWIMFLOW_BOOTSTRAP_ADMIN_APPROVAL !== STAGING.approval) {
    throw new Error('Explicit staging admin approval required.');
  }
  if (env.NEON_PROJECT_ID !== STAGING.projectId ||
      env.NEON_BRANCH_ID !== STAGING.branchId) {
    throw new Error('Neon staging project/branch mismatch.');
  }
  let direct;
  let pooled;
  try {
    direct = new URL(env.DIRECT_URL);
    pooled = new URL(env.DATABASE_URL);
  } catch {
    throw new Error('Both Neon connection URLs are required.');
  }
  for (const [url, host] of [
    [direct, STAGING.directHost],
    [pooled, STAGING.pooledHost],
  ]) {
    if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
        url.hostname !== host ||
        decodeURIComponent(url.pathname.slice(1)) !== STAGING.database ||
        !url.username || !url.password ||
        url.searchParams.get('sslmode') !== 'require' ||
        url.searchParams.get('schema') !== 'public') {
      throw new Error('Neon staging TLS/schema/target mismatch.');
    }
  }
  return direct.toString();
}

function validateAdminInput({ email, fullName, password }) {
  // A bootstrap password must never be accepted, stored or printed.
  if (password !== undefined) {
    throw new Error('Initial admin passwords are forbidden. Use activation by email.');
  }
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const normalizedName = typeof fullName === 'string' ? fullName.trim() : '';
  if (!EMAIL_PATTERN.test(normalizedEmail) || normalizedEmail.length > 320) {
    throw new Error('Invalid admin email.');
  }
  if (normalizedName.length < 2 || normalizedName.length > 160) {
    throw new Error('Admin name must have 2 to 160 characters.');
  }
  return { email: normalizedEmail, fullName: normalizedName };
}

function generateInvitationToken() {
  return randomBytes(32).toString('base64url');
}

/**
 * Atomic, single-account bootstrap/reissue. Returns a raw token only to
 * the trusted in-process mail sender, never to CLI output or the database.
 */
async function bootstrapFirstAdmin(prisma, input, options = {}) {
  const { email, fullName } = validateAdminInput(input);
  const resend = options.resend === true;
  const token = (options.generateToken || generateInvitationToken)();
  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) {
    throw new Error('Invalid generated invitation token.');
  }
  const tokenHash = createHash('sha256').update(token, 'utf8').digest('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITATION_LIFETIME_MS);

  return prisma.$transaction(async (tx) => {
    // Both creation and reissue use the same advisory lock.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(2026102108::bigint)::text AS held`;
    const migrations = await tx.$queryRaw`
      SELECT migration_name FROM "_prisma_migrations"
      WHERE migration_name = '20261021000000_local_auth_identity_foundation'
        AND finished_at IS NOT NULL AND rolled_back_at IS NULL
    `;
    if (!Array.isArray(migrations) || migrations.length !== 1 ||
        migrations[0].migration_name !== FOUNDATION) {
      throw new Error('The identity migration must be applied before bootstrap.');
    }

    const [profiles, identities, sessions] = await Promise.all([
      tx.profile.count(),
      tx.localAuthIdentity.count(),
      tx.authSession.count(),
    ]);
    if (sessions !== 0) {
      throw new Error('Bootstrap denied: existing sessions.');
    }

    let id;
    if (!resend) {
      if (profiles !== 0 || identities !== 0) {
        throw new Error('Bootstrap denied: profiles or identities already exist.');
      }
      id = (options.generateId || randomUUID)();
      await tx.profile.create({
        data: {
          id,
          fullName,
          role: 'admin',
          localAuthIdentity: {
            create: {
              email,
              // The administrator must accept the invitation before login.
              passwordHash: null,
              emailConfirmedAt: null,
              actionTokens: {
                create: { tokenHash, purpose: 'INVITATION', expiresAt },
              },
            },
          },
        },
        select: { id: true },
      });
    } else {
      if (profiles !== 1 || identities !== 1) {
        throw new Error('Invitation reissue requires exactly one pending identity.');
      }
      const profile = await tx.profile.findFirst({
        where: { role: 'admin' },
        select: {
          id: true,
          fullName: true,
          localAuthIdentity: {
            select: {
              email: true, disabledAt: true, emailConfirmedAt: true,
              passwordHash: true,
            },
          },
        },
      });
      if (!profile || profile.fullName !== fullName ||
          profile.localAuthIdentity?.email !== email ||
          profile.localAuthIdentity.disabledAt !== null ||
          profile.localAuthIdentity.emailConfirmedAt !== null ||
          profile.localAuthIdentity.passwordHash !== null) {
        throw new Error('Only the unchanged pending first administrator may reissue.');
      }
      id = profile.id;
      await tx.localAuthActionToken.updateMany({
        where: { userId: id, purpose: 'INVITATION', usedAt: null },
        data: { usedAt: now },
      });
      await tx.localAuthActionToken.create({
        data: { userId: id, tokenHash, purpose: 'INVITATION', expiresAt },
      });
    }

    return { id, email, token, expiresAt, resent: resend };
  }, { isolationLevel: 'ReadCommitted', maxWait: 10000, timeout: 20000 });
}

async function provisionFirstAdminInvitation(prisma, mail, input, options = {}) {
  // Fail before any database write if the verified sender is unavailable.
  mail.assertReady();
  const invitation = await bootstrapFirstAdmin(prisma, input, options);
  // A failed delivery keeps the identity pending. A guarded --resend revokes
  // any previous token and sends a new one; never create a second admin.
  await mail.sendInvitation({
    to: invitation.email,
    token: invitation.token,
    expiresAt: invitation.expiresAt,
  });
  return { id: invitation.id, resent: invitation.resent };
}

async function main() {
  let prisma;
  try {
    const args = process.argv.slice(2);
    const url = assertStagingTarget(process.env, args);
    if (process.env.SWIMFLOW_FIRST_ADMIN_INVITE_ENABLED !== 'true' ||
        process.env.SWIMFLOW_BOOTSTRAP_ADMIN_PASSWORD !== undefined) {
      throw new Error('The invitation-only bootstrap must be explicitly enabled.');
    }
    // The existing mail adapter enforces an HTTPS app origin, sender domain,
    // Resend API key and its own independently enabled rollout flag.
    require('ts-node/register/transpile-only');
    require('tsconfig-paths/register');
    const { ResendInvitationMailSender } =
      require('../src/infra/auth/local-invitation-mail-sender');
    const mail = new ResendInvitationMailSender();
    const input = validateAdminInput({
      email: process.env.SWIMFLOW_BOOTSTRAP_ADMIN_EMAIL,
      fullName: process.env.SWIMFLOW_BOOTSTRAP_ADMIN_NAME,
    });
    mail.assertReady();
    const { PrismaClient } = require('@prisma/client');
    prisma = new PrismaClient({ datasources: { db: { url } }, log: [] });
    const result = await provisionFirstAdminInvitation(
      prisma, mail, input, { resend: args[0] === '--resend' },
    );
    process.stdout.write(
      result.resent
        ? 'Staging first-admin activation invitation reissued.\n'
        : 'Staging first-admin pending identity created; activation invitation sent.\n',
    );
  } catch {
    // Never emit tokens, emails, URLs, mail provider responses or raw DB errors.
    process.stderr.write(
      'First-admin invitation refused or delivery failed. Inspect pending identity privately before retry.\n',
    );
    process.exitCode = 1;
  } finally {
    if (prisma) await prisma.$disconnect();
  }
}

module.exports = {
  STAGING,
  assertStagingTarget,
  validateAdminInput,
  generateInvitationToken,
  bootstrapFirstAdmin,
  provisionFirstAdminInvitation,
};

if (require.main === module) void main();
