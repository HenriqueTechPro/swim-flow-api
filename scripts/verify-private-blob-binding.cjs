#!/usr/bin/env node
'use strict';

// Synthetic records in the isolated GitHub CI PostgreSQL service ONLY.
// No Vercel Blob calls, no student real data, no Render or Neon connection.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

function assertDisposable(env) {
  if (env.SWIMFLOW_DISPOSABLE_DB !== 'yes' || env.NODE_ENV === 'production') {
    throw new Error('Disposable database approval required');
  }
  for (const field of ['DIRECT_URL', 'DATABASE_URL']) {
    const url = new URL(env[field]);
    if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) ||
        url.pathname !== '/swimflow') {
      throw new Error('Refusing a non-disposable database');
    }
  }
}

async function main() {
  assertDisposable(process.env);
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ log: [] });
  const actor = randomUUID();
  const student = randomUUID();
  const other = randomUUID();
  const oldId = randomUUID();
  const nextId = randomUUID();
  const losingId = randomUUID();
  const etag = '"aabbccddeeff00112233445566778899"';
  const verifiedAt = new Date();
  const refs = [oldId, nextId, losingId];

  const create = (id, resourceId, provider = 'BLOB') =>
    prisma.privateMediaObject.create({
      data: {
        id,
        objectKey: `private/students/${resourceId}/${id}.jpg`,
        target: 'student-photo',
        resourceId,
        uploadedById: actor,
        uploadedByProfileId: actor,
        declaredContentType: 'image/jpeg',
        declaredSizeBytes: 200,
        storageProvider: provider,
        status: 'VERIFIED',
        verifiedAt,
        verifiedEtag: etag,
        ticketExpiresAt: provider === 'BLOB'
          ? null : new Date(verifiedAt.getTime() + 86_400_000),
      },
    });

  try {
    await prisma.profile.create({
      data: { id: actor, role: 'admin', fullName: 'Synthetic Binding CI' },
    });
    await create(oldId, student);
    await create(nextId, student);
    await create(losingId, other);

    // No fabricated signed-ticket expiry on server-uploaded files.
    const stored = await prisma.privateMediaObject.findUniqueOrThrow({
      where: { id: oldId },
    });
    assert.equal(stored.ticketExpiresAt, null);
    assert.equal(stored.storageProvider, 'BLOB');

    await prisma.privateMediaActiveBinding.create({
      data: {
        target: 'student-photo',
        resourceId: student,
        mediaId: oldId,
      },
    });

    // The same media ID cannot be used for two profiles or different
    // resource IDs; a foreign child image must be rejected by the FK.
    await assert.rejects(prisma.privateMediaActiveBinding.update({
      where: { target_resourceId: { target: 'student-photo', resourceId: student } },
      data: { mediaId: losingId },
    }));

    // Referenced record is immutable as to provider/status/target.
    await assert.rejects(prisma.privateMediaObject.update({
      where: { id: oldId },
      data: { status: 'REJECTED' },
    }));
    await assert.rejects(prisma.privateMediaObject.update({
      where: { id: oldId },
      data: { storageProvider: 'R2' },
    }));

    const first = await prisma.privateMediaActiveBinding.updateMany({
      where: { target: 'student-photo', resourceId: student, mediaId: oldId },
      data: { mediaId: nextId },
    });
    assert.equal(first.count, 1);
    const stale = await prisma.privateMediaActiveBinding.updateMany({
      where: { target: 'student-photo', resourceId: student, mediaId: oldId },
      data: { mediaId: oldId },
    });
    assert.equal(stale.count, 0);
    const selected = await prisma.privateMediaActiveBinding.findUniqueOrThrow({
      where: { target_resourceId: { target: 'student-photo', resourceId: student } },
    });
    assert.equal(selected.mediaId, nextId);

    // Nonexistent reference must fail closed rather than silently create.
    await assert.rejects(prisma.privateMediaActiveBinding.update({
      where: { target_resourceId: { target: 'student-photo', resourceId: student } },
      data: { mediaId: randomUUID() },
    }));

    process.stdout.write(
      'PASS: Blob active-photo FK, provider/state checks and optimistic replacement.\n',
    );
  } finally {
    await prisma.privateMediaActiveBinding.deleteMany({
      where: { target: 'student-photo', resourceId: student },
    });
    await prisma.privateMediaObject.deleteMany({ where: { id: { in: refs } } });
    await prisma.profile.deleteMany({ where: { id: actor } });
    await prisma.$disconnect();
  }
}
void main().catch(() => {
  process.stderr.write('Private Blob binding in disposable PostgreSQL failed.\n');
  process.exitCode = 1;
});
