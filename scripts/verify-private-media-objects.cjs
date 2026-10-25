#!/usr/bin/env node
'use strict';

// Private-media migration regression. Disposable local PostgreSQL ONLY.
// Does not talk to Neon, Render, R2, Supabase or any external provider.
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');

function assertDisposableDb(env) {
  if (env.SWIMFLOW_DISPOSABLE_DB !== 'yes' || env.NODE_ENV === 'production') {
    throw new Error('Refusing private-media test outside disposable CI');
  }
  for (const name of ['DATABASE_URL', 'DIRECT_URL']) {
    let parsed;
    try { parsed = new URL(env[name]); } catch {
      throw new Error('Refusing invalid disposable database URL');
    }
    if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)
        || parsed.pathname !== '/swimflow') {
      throw new Error('Refusing nonlocal private-media database');
    }
  }
}

async function run() {
  assertDisposableDb(process.env);
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ log: [] });
  const actorId = randomUUID();
  const resourceId = randomUUID();
  const objectId = randomUUID();
  const objectKey = `private/students/${resourceId}/${objectId}.png`;
  try {
    await prisma.profile.create({
      data: { id: actorId, role: 'admin', fullName: 'CI Media Actor' },
    });
    const pending = {
      id: objectId,
      objectKey,
      target: 'student-photo',
      resourceId,
      uploadedById: actorId,
      uploadedByProfileId: actorId,
      declaredContentType: 'image/png',
      declaredSizeBytes: 1234,
      ticketExpiresAt: new Date(Date.now() + 90_000),
    };
    const created = await prisma.privateMediaObject.create({ data: pending });
    assert.equal(created.status, 'PENDING');
    assert.equal(created.verifiedAt, null);
    assert.equal(created.uploadedById, actorId);
    assert.equal(created.objectKey, objectKey);

    // PostgreSQL CHECK constraints are authoritative, not only Zod.
    await assert.rejects(prisma.privateMediaObject.create({
      data: {
        ...pending, id: randomUUID(),
        objectKey: `private/students/${resourceId}/${randomUUID()}.png`,
        declaredSizeBytes: 5 * 1024 * 1024 + 1,
      },
    }));
    await assert.rejects(prisma.privateMediaObject.create({
      data: {
        ...pending, id: randomUUID(),
        objectKey: `private/students/${resourceId}/${randomUUID()}.png`,
        status: 'VERIFIED',
      },
    }));
    await assert.rejects(prisma.privateMediaObject.create({
      data: {
        ...pending, id: randomUUID(),
        objectKey: `public/students/${resourceId}/${randomUUID()}.png`,
      },
    }));

    // Preserve the audit actor ID even if their profile is deleted.
    await prisma.profile.delete({ where: { id: actorId } });
    const retained = await prisma.privateMediaObject.findUniqueOrThrow({
      where: { id: objectId },
    });
    assert.equal(retained.uploadedByProfileId, null);
    assert.equal(retained.uploadedById, actorId);
    assert.equal(retained.status, 'PENDING');
    assert.equal(await prisma.privateMediaObject.count(), 1);
    process.stdout.write('PASS: disposable private media pending metadata, constraints and uploader snapshot.\n');
  } finally {
    await prisma.privateMediaObject.deleteMany({ where: { id: objectId } });
    await prisma.profile.deleteMany({ where: { id: actorId } });
    await prisma.$disconnect();
  }
}

void run().catch(() => {
  process.stderr.write('Disposable private-media database verification failed.\n');
  process.exitCode = 1;
});
