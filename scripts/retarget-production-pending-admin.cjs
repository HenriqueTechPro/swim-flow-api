#!/usr/bin/env node
'use strict';

// One-time email correction for the sole UNACTIVATED Neon production administrator.
// This script never sends mail or prints email addresses, tokens or credentials.
const { assertProductionBootstrapTarget } = require('./bootstrap-production-first-admin.cjs');
const { validateAdminInput } = require('./bootstrap-first-admin.cjs');
const { EXPECTED_MIGRATIONS } = require('./neon-production-target.cjs');

const RETARGET_APPROVAL = 'RETARGET_RAIANEXO_PENDING_ADMIN_ONCE';

function assertRetargetTarget(env, args) {
  if (!Array.isArray(args) || args.length !== 1 || args[0] !== '--retarget') {
    throw new Error('Explicit --retarget required.');
  }
  if (env.SWIMFLOW_PENDING_ADMIN_RETARGET_APPROVAL !== RETARGET_APPROVAL) {
    throw new Error('Explicit pending-admin email correction approval required.');
  }
  // Reuse the reviewed production-only Neon host, branch, TLS and credentials guard.
  // This only checks the destination; it does NOT invoke the resend operation.
  const url = assertProductionBootstrapTarget(env, ['--resend']);
  const input = validateAdminInput({
    email: env.SWIMFLOW_BOOTSTRAP_ADMIN_EMAIL,
    fullName: env.SWIMFLOW_BOOTSTRAP_ADMIN_NAME,
  });
  return { url, input };
}

async function retargetPendingAdministrator(prisma, input) {
  const { email, fullName } = validateAdminInput(input);
  return prisma.$transaction(async (tx) => {
    // Same lock used by first-admin creation and resend: no concurrent bootstrap.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(2026102108::bigint)::text AS held`;
    const migrations = await tx.$queryRaw`
      SELECT migration_name FROM public._prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      ORDER BY migration_name
    `;
    if (!Array.isArray(migrations) ||
        JSON.stringify(migrations.map((row) => row.migration_name)) !==
          JSON.stringify(EXPECTED_MIGRATIONS)) {
      throw new Error('Production migrations differ from the reviewed baseline.');
    }

    const [profiles, identities, sessions] = await Promise.all([
      tx.profile.count(),
      tx.localAuthIdentity.count(),
      tx.authSession.count(),
    ]);
    if (profiles !== 1 || identities !== 1 || sessions !== 0) {
      throw new Error('Email correction requires one sole pending administrator and no sessions.');
    }
    const profile = await tx.profile.findFirst({
      where: { role: 'admin' },
      select: {
        id: true,
        fullName: true,
        localAuthIdentity: {
          select: {
            email: true,
            passwordHash: true,
            emailConfirmedAt: true,
            disabledAt: true,
            lastSignInAt: true,
          },
        },
      },
    });
    const identity = profile?.localAuthIdentity;
    if (!profile || profile.fullName !== fullName || !identity ||
        identity.passwordHash !== null || identity.emailConfirmedAt !== null ||
        identity.disabledAt !== null || identity.lastSignInAt !== null) {
      throw new Error('Email correction refused: administrator is changed or activated.');
    }
    if (identity.email === email) {
      throw new Error('Email correction refused: pending email already matches the target.');
    }
    // Never overwrite an unrelated pending flow on the same identity.
    const otherTokens = await tx.localAuthActionToken.count({
      where: { userId: profile.id, purpose: { not: 'INVITATION' }, usedAt: null },
    });
    if (otherTokens !== 0) {
      throw new Error('Email correction refused: unexpected pending action tokens.');
    }

    const updated = await tx.localAuthIdentity.updateMany({
      where: {
        userId: profile.id,
        email: identity.email,
        passwordHash: null,
        emailConfirmedAt: null,
        disabledAt: null,
        lastSignInAt: null,
      },
      data: { email },
    });
    if (updated.count !== 1) {
      throw new Error('Pending identity changed during correction.');
    }
    // A token originally generated for the old recipient may never be reused.
    await tx.localAuthActionToken.updateMany({
      where: { userId: profile.id, purpose: 'INVITATION', usedAt: null },
      data: { usedAt: new Date() },
    });
    return true;
  }, { isolationLevel: 'ReadCommitted', maxWait: 10000, timeout: 20000 });
}

async function main() {
  let prisma;
  try {
    const { url, input } = assertRetargetTarget(process.env, process.argv.slice(2));
    const { PrismaClient } = require('@prisma/client');
    prisma = new PrismaClient({ datasources: { db: { url } }, log: [] });
    await retargetPendingAdministrator(prisma, input);
    process.stdout.write(
      'RaiaNexo pending first-admin email corrected; previous invitation tokens revoked. Run guarded resend separately.\n',
    );
  } catch {
    process.stderr.write(
      'RaiaNexo pending first-admin email correction refused; no details disclosed.\n',
    );
    process.exitCode = 1;
  } finally {
    if (prisma) await prisma.$disconnect();
  }
}

module.exports = { RETARGET_APPROVAL, assertRetargetTarget, retargetPendingAdministrator };
if (require.main === module) void main();
