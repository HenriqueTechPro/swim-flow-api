#!/usr/bin/env node
'use strict';

// Real PostgreSQL concurrency and JWT revocation test. NEVER point at Neon.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

function requireDisposableDatabase(env) {
  if (env.SWIMFLOW_DISPOSABLE_DB !== 'yes' || env.NODE_ENV === 'production') {
    throw new Error('Refusing real auth tests outside disposable PostgreSQL');
  }
  for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
    let url;
    try { url = new URL(env[key]); } catch {
      throw new Error('Refusing invalid disposable database URL');
    }
    if (
      !['localhost', '127.0.0.1', '::1'].includes(url.hostname) ||
      url.pathname !== '/swimflow'
    ) {
      throw new Error('Refusing nonlocal or non-disposable database');
    }
  }
}

async function run() {
  requireDisposableDatabase(process.env);
  require('ts-node/register/transpile-only');
  require('tsconfig-paths/register');
  const { PrismaClient } = require('@prisma/client');
  const { JwtService } = require('@nestjs/jwt');
  const { JwtAuthGuard } = require('../src/infra/auth/jwt-auth.guard');
  const { PrismaAuthSessionsRepository } =
    require('../src/infra/database/prisma/repositories/prisma-auth-sessions-repository');
  const { hashRefreshToken } = require('../src/infra/auth/refresh-token.helpers');

  const firstDb = new PrismaClient({ log: [] });
  const secondDb = new PrismaClient({ log: [] });
  const firstRepo = new PrismaAuthSessionsRepository(firstDb);
  const secondRepo = new PrismaAuthSessionsRepository(secondDb);
  const userId = randomUUID();
  const email = `auth-ci-${userId}@example.invalid`;
  const jwt = new JwtService();
  const jwtKey = 'ci-only-jwt-secret-for-disposable-postgresql-tests';
  const guard = new JwtAuthGuard(jwt, firstRepo, { jwtAccessSecret: jwtKey });

  const access = async (sessionId) => jwt.signAsync({
    sub: userId,
    email,
    sessionId,
  }, { secret: jwtKey, expiresIn: '900s' });
  const isAllowed = async (accessToken) => {
    const req = { headers: { authorization: `Bearer ${accessToken}` } };
    return guard.canActivate({
      switchToHttp: () => ({ getRequest: () => req }),
    });
  };

  try {
    await firstDb.profile.create({
      data: {
        id: userId,
        fullName: 'Fictitious Auth Concurrency User',
        role: 'teacher',
        localAuthIdentity: {
          create: {
            email,
            emailConfirmedAt: new Date(),
            passwordHash: 'ci-only-not-a-real-bcrypt-hash',
          },
        },
      },
    });
    const currentHash = hashRefreshToken('ci-original-refresh-token');
    const old = await firstRepo.create({
      userId,
      email,
      refreshTokenHash: currentHash,
      expiresAt: new Date(Date.now() + 120000),
    });
    assert.equal(await isAllowed(await access(old.id)), true);

    const nextInput = (index) => ({
      userId,
      email,
      refreshTokenHash: hashRefreshToken(`ci-successor-${index}`),
      expiresAt: new Date(Date.now() + 120000),
    });
    const [a, b] = await Promise.all([
      firstRepo.rotateRefreshSession(old.id, currentHash, nextInput('A')),
      secondRepo.rotateRefreshSession(old.id, currentHash, nextInput('B')),
    ]);
    const winners = [a, b].filter(Boolean);
    assert.equal(winners.length, 1, 'exactly one rotation must win');
    const successor = winners[0];
    const previous = await firstDb.authSession.findUniqueOrThrow({
      where: { id: old.id },
    });
    assert.ok(previous.revokedAt, 'old token must be revoked');
    assert.equal(previous.replacedBySessionId, successor.id);
    assert.equal(await firstDb.authSession.count({ where: { userId } }), 2,
      'a losing concurrent request must not leave an orphan session');

    await assert.rejects(
      async () => isAllowed(await access(old.id)),
      (error) => error?.status === 401,
    );
    assert.equal(await isAllowed(await access(successor.id)), true);
    assert.equal(
      await secondRepo.rotateRefreshSession(old.id, currentHash, nextInput('replay')),
      null,
    );
    assert.equal(await firstDb.authSession.count({ where: { userId } }), 2);

    // Logout revokes the current access token without changing its signature.
    await firstRepo.revoke(successor.id);
    await assert.rejects(
      async () => isAllowed(await access(successor.id)),
      (error) => error?.status === 401,
    );
    process.stdout.write(
      'PASS: disposable PostgreSQL atomic refresh race, replay, JWT and logout revocation.\n',
    );
  } finally {
    await firstDb.profile.deleteMany({ where: { id: userId } });
    await Promise.all([firstDb.$disconnect(), secondDb.$disconnect()]);
  }
}

void run().catch(() => {
  process.stderr.write('Disposable PostgreSQL authentication security test failed.\n');
  process.exitCode = 1;
});
