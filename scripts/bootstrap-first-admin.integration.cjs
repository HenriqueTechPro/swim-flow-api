#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { compare } = require('bcryptjs');
const { bootstrapFirstAdmin, provisionFirstAdminInvitation } = require('./bootstrap-first-admin.cjs');
const { assertDisposablePostgres } = require('./bootstrap-disposable-guard.cjs');

async function main() {
  assertDisposablePostgres(process.env);
  require('ts-node/register/transpile-only');
  require('tsconfig-paths/register');
  const { LocalAuthActionTokensService } = require('../src/infra/auth/local-auth-action-tokens.service');
  const { LocalPasswordIdentityService } = require('../src/infra/auth/local-password-identity.service');

  const a = new PrismaClient({ log: [] });
  const b = new PrismaClient({ log: [] });
  const messages = [];
  const mail = {
    assertReady() {},
    async sendInvitation(message) { messages.push(message); },
  };
  const first = {
    email: 'ci-admin-one@example.invalid',
    fullName: 'CI Admin One',
  };
  const second = {
    email: 'ci-admin-two@example.invalid',
    fullName: 'CI Admin Two',
  };
  let createdId;
  try {
    const results = await Promise.allSettled([
      provisionFirstAdminInvitation(a, mail, first),
      provisionFirstAdminInvitation(b, mail, second),
    ]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.filter(r => r.status === 'rejected').length, 1);
    createdId = results.find(r => r.status === 'fulfilled').value.id;
    const pending = await a.profile.findUnique({
      where: { id: createdId },
      include: {
        localAuthIdentity: { include: { actionTokens: true } },
      },
    });
    assert.equal(pending.role, 'admin');
    assert.equal(pending.localAuthIdentity.emailConfirmedAt, null);
    assert.equal(pending.localAuthIdentity.passwordHash, null);
    assert.equal(messages.length, 1);
    const firstToken = messages[0].token;
    assert.equal(messages[0].to, pending.localAuthIdentity.email);
    assert.equal(pending.localAuthIdentity.actionTokens.length, 1);
    assert.equal(
      pending.localAuthIdentity.actionTokens[0].tokenHash,
      createHash('sha256').update(firstToken).digest('hex'),
    );
    assert.notEqual(pending.localAuthIdentity.actionTokens[0].tokenHash, firstToken);

    assert.equal(await a.profile.count(), 1);
    assert.equal(await a.localAuthIdentity.count(), 1);
    await assert.rejects(() => bootstrapFirstAdmin(a, {
      email: 'ci-retry@example.invalid', fullName: 'Duplicate Admin',
    }));

    const identity = {
      email: pending.localAuthIdentity.email,
      fullName: pending.fullName,
    };
    const resent = await provisionFirstAdminInvitation(a, mail, identity, {
      resend: true,
    });
    assert.equal(resent.id, createdId);
    assert.equal(resent.resent, true);
    assert.equal(messages.length, 2);
    const secondToken = messages[1].token;
    assert.notEqual(firstToken, secondToken);

    const actions = new LocalAuthActionTokensService(
      a, new LocalPasswordIdentityService(a),
    );
    const password = 'ci-activation-password-unique-2026';
    await assert.rejects(() =>
      actions.redeemWithPassword(firstToken, 'INVITATION', password),
    );
    await actions.redeemWithPassword(secondToken, 'INVITATION', password);
    const active = await a.localAuthIdentity.findUnique({
      where: { userId: createdId },
    });
    assert.ok(active.emailConfirmedAt);
    assert.ok(active.passwordHash);
    assert.equal(await compare(password, active.passwordHash), true);

    await assert.rejects(() => provisionFirstAdminInvitation(a, mail, identity, {
      resend: true,
    }));
    assert.equal(messages.length, 2);
    process.stdout.write('Disposable PostgreSQL first-admin pending invite, concurrency, resend, activation verified.\n');
  } finally {
    if (createdId) await a.profile.deleteMany({ where: { id: createdId } });
    await Promise.all([a.$disconnect(), b.$disconnect()]);
  }
}
void main().catch(() => {
  process.stderr.write('Disposable PostgreSQL first-admin invitation test failed.\n');
  process.exitCode = 1;
});
