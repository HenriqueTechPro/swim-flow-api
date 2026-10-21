#!/usr/bin/env node
'use strict';

// This script refuses to connect to Neon or any non-local PostgreSQL.
const { assertDisposablePostgres } = require('./bootstrap-disposable-guard.cjs');
assertDisposablePostgres(process.env);

const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
require('ts-node/register/transpile-only');
require('tsconfig-paths/register');
const { PrismaClient } = require('@prisma/client');
const { compare } = require('bcryptjs');
const { LocalPasswordIdentityService } = require('../src/infra/auth/local-password-identity.service');
const { LocalAuthActionTokensService } = require('../src/infra/auth/local-auth-action-tokens.service');

async function main() {
  const prisma = new PrismaClient({ log: [] });
  const id = randomUUID();
  const password = 'integration-only-password-2026';
  try {
    await prisma.profile.create({
      data: {
        id,
        fullName: 'Action Token Integration',
        role: 'user',
        localAuthIdentity: {
          create: { email: 'ci-action-' + id + '@example.invalid' },
        },
      },
    });
    const actions = new LocalAuthActionTokensService(
      prisma,
      new LocalPasswordIdentityService(prisma),
    );

    const invitation = await actions.issueForIdentity(id, 'INVITATION');
    assert.match(invitation.token, /^[A-Za-z0-9_-]{43}$/);
    const inviteHash = createHash('sha256').update(invitation.token).digest('hex');
    const storedInvite = await prisma.localAuthActionToken.findUnique({
      where: { tokenHash: inviteHash },
    });
    assert.ok(storedInvite);
    assert.equal(storedInvite.purpose, 'INVITATION');
    assert.equal(storedInvite.tokenHash === invitation.token, false);
    // Two transactions race over the same identity. Exactly one succeeds;
    // there must be no Postgres deadlock or leaked active session.
    const invitationRace = await Promise.allSettled([
      actions.redeemWithPassword(invitation.token, 'INVITATION', password),
      actions.issueForIdentity(id, 'INVITATION'),
    ]);
    assert.equal(invitationRace.filter(x => x.status === 'fulfilled').length, 1);
    assert.equal(invitationRace.filter(x => x.status === 'rejected').length, 1);
    const accepted = invitationRace[0].status === 'fulfilled'
      ? invitationRace[0].value
      : await actions.redeemWithPassword(invitationRace[1].value.token, 'INVITATION', password);
    assert.equal(accepted.id, id);
    await assert.rejects(() =>
      actions.redeemWithPassword(invitation.token, 'INVITATION', password),
    );
    const confirmed = await prisma.localAuthIdentity.findUnique({
      where: { userId: id },
    });
    assert.ok(confirmed.emailConfirmedAt);
    assert.equal(await compare(password, confirmed.passwordHash), true);
    await assert.rejects(() => actions.issueForIdentity(id, 'INVITATION'));

    const session = await prisma.authSession.create({
      data: {
        userId: id,
        email: confirmed.email,
        refreshTokenHash: createHash('sha256').update(randomUUID()).digest('hex'),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const firstReset = await actions.issueForIdentity(id, 'PASSWORD_RESET');
    const secondReset = await actions.issueForIdentity(id, 'PASSWORD_RESET');
    await assert.rejects(() =>
      actions.redeemWithPassword(firstReset.token, 'PASSWORD_RESET', password),
    );
    const newPassword = 'completely-new-password-2026';
    const concurrency = await Promise.allSettled([
      actions.redeemWithPassword(secondReset.token, 'PASSWORD_RESET', newPassword),
      actions.redeemWithPassword(secondReset.token, 'PASSWORD_RESET', newPassword),
    ]);
    assert.equal(concurrency.filter(x => x.status === 'fulfilled').length, 1);
    assert.equal(concurrency.filter(x => x.status === 'rejected').length, 1);
    const updated = await prisma.localAuthIdentity.findUnique({ where: { userId: id } });
    assert.equal(await compare(newPassword, updated.passwordHash), true);
    assert.equal(await compare(password, updated.passwordHash), false);
    const revoked = await prisma.authSession.findUnique({ where: { id: session.id } });
    assert.ok(revoked.revokedAt);
    assert.ok(await prisma.localAuthActionToken.count({ where: { userId: id } }) >= 3);
    process.stdout.write('PostgreSQL local action token issuance, replay, concurrency and revocation verified.\n');
  } finally {
    await prisma.profile.deleteMany({ where: { id } });
    await prisma.$disconnect();
  }
}

void main().catch(() => {
  process.stderr.write('Local token integration failed on disposable PostgreSQL.\n');
  process.exitCode = 1;
});
