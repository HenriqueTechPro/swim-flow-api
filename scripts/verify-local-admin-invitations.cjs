#!/usr/bin/env node
'use strict';

// No credentials may be written unless BOTH URLs are disposable local.
const { assertDisposablePostgres } = require('./bootstrap-disposable-guard.cjs');
assertDisposablePostgres(process.env);
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
require('ts-node/register/transpile-only');
require('tsconfig-paths/register');
const { PrismaClient } = require('@prisma/client');
const { LocalPasswordIdentityService } = require('../src/infra/auth/local-password-identity.service');
const { LocalAuthActionTokensService } = require('../src/infra/auth/local-auth-action-tokens.service');
const { LocalAdminInvitationsService } = require('../src/infra/auth/local-admin-invitations.service');

async function main() {
  const prisma = new PrismaClient({ log: [] });
  const adminId = randomUUID();
  const createdIds = [adminId];
  const messages = [];
  const mail = {
    assertReady: () => {},
    sendInvitation: async (message) => { messages.push(message); },
  };
  const passwords = new LocalPasswordIdentityService(prisma);
  const actions = new LocalAuthActionTokensService(prisma, passwords);
  const invitations = new LocalAdminInvitationsService(prisma, actions, mail);
  const email = 'ci-invite-' + randomUUID() + '@example.invalid';
  const password = 'an-unique-admin-passphrase-2026';

  try {
    await prisma.profile.create({
      data: {
        id: adminId,
        fullName: 'Local Admin CI',
        role: 'admin',
        localAuthIdentity: {
          create: {
            email: 'ci-admin-' + adminId + '@example.invalid',
            passwordHash: await passwords.hashPasswordForProvisioning(password),
            emailConfirmedAt: new Date(),
          },
        },
      },
    });

    await assert.rejects(() => invitations.invite({
      actorUserId: randomUUID(), email, role: 'teacher',
    }));
    assert.equal(await prisma.localAuthIdentity.count({ where: { email } }), 0);

    const first = await invitations.invite({
      actorUserId: adminId, email: email.toUpperCase(), role: 'teacher',
      fullName: '  Swim Coach CI ',
    });
    createdIds.push(first.id);
    assert.equal(first.email, email);
    assert.equal(messages.length, 1);

    const pending = await prisma.profile.findUnique({
      where: { id: first.id },
      include: {
        localAuthIdentity: { include: { actionTokens: true } },
      },
    });
    assert.equal(pending.role, 'teacher');
    assert.equal(pending.fullName, 'Swim Coach CI');
    assert.equal(pending.localAuthIdentity.passwordHash, null);
    assert.equal(pending.localAuthIdentity.emailConfirmedAt, null);
    assert.equal(pending.localAuthIdentity.actionTokens.length, 1);
    assert.equal(
      pending.localAuthIdentity.actionTokens[0].tokenHash,
      createHash('sha256').update(messages[0].token).digest('hex'),
    );

    await assert.rejects(() => invitations.invite({
      actorUserId: adminId, email, role: 'admin',
    }));
    assert.equal(messages.length, 1);

    const renewed = await invitations.invite({
      actorUserId: adminId, email, role: 'teacher',
    });
    assert.equal(renewed.id, first.id);
    assert.equal(messages.length, 2);
    assert.notEqual(messages[0].token, messages[1].token);
    await assert.rejects(() => actions.redeemWithPassword(
      messages[0].token, 'INVITATION', 'new-user-password-2026',
    ));
    await actions.redeemWithPassword(
      messages[1].token, 'INVITATION', 'new-user-password-2026',
    );

    await assert.rejects(() => invitations.invite({
      actorUserId: adminId, email, role: 'teacher',
    }));
    assert.equal(await prisma.profile.count({ where: { id: first.id } }), 1);

    // Disabled local administrators cannot invite even if role is still admin.
    await prisma.localAuthIdentity.update({
      where: { userId: adminId }, data: { disabledAt: new Date() },
    });
    await assert.rejects(() => invitations.invite({
      actorUserId: adminId, email: 'another-' + randomUUID() + '@example.invalid',
      role: 'user',
    }));

    process.stdout.write('Local admin invitations: privileges, pending state, reissue and acceptance verified.\n');
  } finally {
    await prisma.profile.deleteMany({ where: { id: { in: createdIds } } });
    await prisma.$disconnect();
  }
}

void main().catch(() => {
  process.stderr.write('Disposable PostgreSQL invitation integration failed.\n');
  process.exitCode = 1;
});
