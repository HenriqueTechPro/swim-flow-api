#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { compare } = require('bcryptjs');
const { bootstrapFirstAdmin } = require('./bootstrap-first-admin.cjs');

async function main() {
  const url = new URL(process.env.DIRECT_URL || '');
  if (process.env.SWIMFLOW_DISPOSABLE_DB !== 'yes' ||
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      url.pathname !== '/swimflow') {
    throw new Error('Integration test requires disposable local PostgreSQL.');
  }
  const a = new PrismaClient({ log: [] });
  const b = new PrismaClient({ log: [] });
  const password = 'ci-only-admin-password-02e8b';
  let createdId;
  try {
    const results = await Promise.allSettled([
      bootstrapFirstAdmin(a, { email: 'ci-admin-one@example.invalid', fullName: 'CI Admin One', password }),
      bootstrapFirstAdmin(b, { email: 'ci-admin-two@example.invalid', fullName: 'CI Admin Two', password }),
    ]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.filter(r => r.status === 'rejected').length, 1);
    createdId = results.find(r => r.status === 'fulfilled').value.id;
    const admin = await a.profile.findUnique({
      where: { id: createdId },
      include: { localAuthIdentity: true },
    });
    assert.equal(admin.role, 'admin');
    assert.ok(admin.localAuthIdentity.emailConfirmedAt);
    assert.equal(await compare(password, admin.localAuthIdentity.passwordHash), true);
    assert.equal(await a.profile.count(), 1);
    assert.equal(await a.localAuthIdentity.count(), 1);
    await assert.rejects(() => bootstrapFirstAdmin(a, {
      email: 'retry@example.invalid', fullName: 'Retry Attempt', password,
    }));
    process.stdout.write('Disposable PostgreSQL first admin and concurrent execution verified.\n');
  } finally {
    if (createdId) await a.profile.deleteMany({ where: { id: createdId } });
    await Promise.all([a.$disconnect(), b.$disconnect()]);
  }
}
void main().catch(() => {
  process.stderr.write('Disposable PostgreSQL admin bootstrap test failed.\n');
  process.exitCode = 1;
});
