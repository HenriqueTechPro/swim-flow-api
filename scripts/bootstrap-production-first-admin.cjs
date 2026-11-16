#!/usr/bin/env node
'use strict';

// Production-only first administrator invitation; no automatic execution.
// The staging bootstrap remains unchanged and cannot target this database.
const { TARGET } = require('./neon-production-target.cjs');
const {
  validateAdminInput,
  provisionFirstAdminInvitation,
} = require('./bootstrap-first-admin.cjs');

const APPROVAL = 'BOOTSTRAP_SWIM_FLOW_PRODUCTION_ADMIN_ONCE';

function assertProductionBootstrapTarget(env, args) {
  if (args.length !== 1 || !['--apply', '--resend'].includes(args[0])) {
    throw new Error('Explicit --apply or --resend required.');
  }
  if (env.NEON_PROJECT_ID !== TARGET.projectId ||
      env.NEON_BRANCH_ID !== TARGET.branchId ||
      env.SWIMFLOW_PRODUCTION_BOOTSTRAP_ADMIN_APPROVAL !== APPROVAL) {
    throw new Error('Explicit approval for this Neon production project/branch required.');
  }
  let direct;
  let pooled;
  try {
    direct = new URL(env.DIRECT_URL);
    pooled = new URL(env.DATABASE_URL);
  } catch {
    throw new Error('Both Neon production connection URLs are required.');
  }
  for (const [url, host] of [[direct, TARGET.directHost], [pooled, TARGET.pooledHost]]) {
    if (!['postgresql:', 'postgres:'].includes(url.protocol) ||
        url.hostname.toLowerCase() !== host ||
        decodeURIComponent(url.pathname.slice(1)) !== TARGET.database ||
        !url.username || !url.password ||
        url.searchParams.get('sslmode') !== 'require' ||
        (url.searchParams.has('schema') && url.searchParams.get('schema') !== 'public') ||
        url.hash) {
      throw new Error('Neon production URL host/database/TLS/schema mismatch.');
    }
  }
  if (direct.username !== pooled.username || direct.password !== pooled.password) {
    throw new Error('Neon production pooled/direct identities differ.');
  }
  return direct.toString();
}

async function main() {
  let prisma;
  try {
    const args = process.argv.slice(2);
    const url = assertProductionBootstrapTarget(process.env, args);
    if (process.env.SWIMFLOW_FIRST_ADMIN_INVITE_ENABLED !== 'true' ||
        process.env.SWIMFLOW_BOOTSTRAP_ADMIN_PASSWORD !== undefined) {
      throw new Error('Invite-only bootstrap must be enabled; passwords are forbidden.');
    }
    // The email provider verifies the sender and HTTPS origin before any DB write.
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
    process.stdout.write(result.resent
      ? 'Production first-admin invitation reissued.\n'
      : 'Production first-admin pending identity created; invitation sent.\n');
  } catch {
    // No emails, tokens, connection strings or delivery provider payloads in logs.
    process.stderr.write('Production bootstrap refused or delivery failed. Inspect pending identity privately before retry.\n');
    process.exitCode = 1;
  } finally {
    if (prisma) await prisma.$disconnect();
  }
}

module.exports = { APPROVAL, assertProductionBootstrapTarget };
if (require.main === module) void main();
