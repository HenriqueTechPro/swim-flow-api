#!/usr/bin/env node
'use strict';

// Disposable PostgreSQL ONLY. Checks real conditional status transitions
// under concurrent writes, without any S3 call or external credentials.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

function assertDisposableDb(env) {
  if (env.SWIMFLOW_DISPOSABLE_DB !== 'yes' || env.NODE_ENV === 'production') {
    throw new Error('Private media lifecycle verifier requires disposable CI');
  }
  for (const name of ['DATABASE_URL', 'DIRECT_URL']) {
    let url;
    try { url = new URL(env[name]); } catch {
      throw new Error('Invalid disposable PostgreSQL URL');
    }
    if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)
        || url.pathname !== '/swimflow') {
      throw new Error('Refusing nonlocal database');
    }
  }
}

async function run() {
  assertDisposableDb(process.env);
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ log: [] });
  const actor = randomUUID();
  const resource = randomUUID();
  const verifiedId = randomUUID();
  const raceId = randomUUID();
  const expired = new Date(Date.now() - 5 * 60_000);
  const cutoff = new Date(Date.now() - 2 * 60_000);
  const now = new Date();
  const etag = '"d41d8cd98f00b204e9800998ecf8427e"';
  const ids = [verifiedId, raceId];

  const toInput = (id) => ({
    id,
    objectKey: `private/students/${resource}/${id}.png`,
    target: 'student-photo',
    resourceId: resource,
    uploadedById: actor,
    uploadedByProfileId: actor,
    declaredContentType: 'image/png',
    declaredSizeBytes: 1024,
    // An expired ticket must still be later than the original row creation.
    createdAt: new Date(expired.getTime() - 60_000),
    ticketExpiresAt: expired,
  });

  try {
    await prisma.profile.create({
      data: { id: actor, role: 'admin', fullName: 'CI Lifecycle Actor' },
    });
    await prisma.privateMediaObject.createMany({
      data: ids.map(toInput),
    });

    const tooEarly = await prisma.privateMediaObject.updateMany({
      where: {
        id: verifiedId,
        status: 'PENDING',
        ticketExpiresAt: { lte: new Date(expired.getTime() - 1) },
      },
      data: { status: 'REJECTED' },
    });
    assert.equal(tooEarly.count, 0);

    const good = await prisma.privateMediaObject.updateMany({
      where: { id: verifiedId, status: 'PENDING', ticketExpiresAt: { lte: cutoff } },
      data: { status: 'VERIFIED', verifiedAt: now, verifiedEtag: etag },
    });
    assert.equal(good.count, 1);
    assert.equal((await prisma.privateMediaObject.findUniqueOrThrow({ where: { id: verifiedId } })).verifiedEtag, etag);
    assert.equal((await prisma.privateMediaObject.updateMany({
      where: { id: verifiedId, status: 'PENDING', ticketExpiresAt: { lte: cutoff } },
      data: { status: 'REJECTED' },
    })).count, 0);

    // A VERIFIED row must be protected from deletion transitions.
    assert.equal((await prisma.privateMediaObject.updateMany({
      where: { id: verifiedId, status: 'REJECTED' },
      data: { status: 'DELETED' },
    })).count, 0);

    // Both operations race for PENDING. Exactly one may win.
    const [confirm, reject] = await Promise.all([
      prisma.privateMediaObject.updateMany({
        where: { id: raceId, status: 'PENDING', ticketExpiresAt: { lte: cutoff } },
        data: { status: 'VERIFIED', verifiedAt: now, verifiedEtag: etag },
      }),
      prisma.privateMediaObject.updateMany({
        where: { id: raceId, status: 'PENDING', ticketExpiresAt: { lte: cutoff } },
        data: { status: 'REJECTED' },
      }),
    ]);
    assert.equal(confirm.count + reject.count, 1);
    const winner = await prisma.privateMediaObject.findUniqueOrThrow({ where: { id: raceId } });
    assert.equal(winner.status, confirm.count ? 'VERIFIED' : 'REJECTED');

    if (reject.count === 1) {
      const deleted = await prisma.privateMediaObject.updateMany({
        where: { id: raceId, status: 'REJECTED' },
        data: { status: 'DELETED' },
      });
      assert.equal(deleted.count, 1);
      assert.equal((await prisma.privateMediaObject.findUniqueOrThrow({
        where: { id: raceId },
      })).status, 'DELETED');
    }

    assert.equal((await prisma.privateMediaObject.findUniqueOrThrow({
      where: { id: verifiedId },
    })).status, 'VERIFIED');

    process.stdout.write('PASS: private media transitions and concurrent CAS in disposable PostgreSQL.\n');
  } finally {
    await prisma.privateMediaObject.deleteMany({ where: { id: { in: ids } } });
    await prisma.profile.deleteMany({ where: { id: actor } });
    await prisma.$disconnect();
  }
}

void run().catch(() => {
  process.stderr.write('Private media lifecycle verification failed in disposable PostgreSQL.\n');
  process.exitCode = 1;
});
