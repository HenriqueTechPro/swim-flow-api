#!/usr/bin/env node
'use strict';

// PostgreSQL disposable ONLY. No Blob, Neon or Render connection.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

function assertDisposable(env) {
  if (env.SWIMFLOW_DISPOSABLE_DB !== 'yes' || env.NODE_ENV === 'production') {
    throw new Error('Disposable CI database required');
  }
  for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
    const url = new URL(env[key]);
    if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) ||
        url.pathname !== '/swimflow') {
      throw new Error('Refusing to write nonlocal database');
    }
  }
}
async function main() {
  assertDisposable(process.env);
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ log: [] });
  const actor = randomUUID();
  const student = randomUUID();
  const id = randomUUID();
  const verifiedAt = new Date();
  const key = `private/students/${student}/${id}.jpg`;
  const etag = '"123456789abcdef0123456789abcdef0"';
  try {
    await prisma.profile.create({
      data: { id: actor, role: 'admin', fullName: 'Synthetic Blob Test' },
    });
    const created = await prisma.privateMediaObject.create({
      data: {
        id,
        objectKey: key,
        target: 'student-photo',
        resourceId: student,
        uploadedById: actor,
        uploadedByProfileId: actor,
        declaredContentType: 'image/jpeg',
        declaredSizeBytes: 128,
        status: 'VERIFIED',
        storageProvider: 'BLOB',
        verifiedAt,
        verifiedEtag: etag,
        ticketExpiresAt: null,
      },
    });
    assert.equal(created.status, 'VERIFIED');
    assert.equal(created.verifiedEtag, etag);
    assert.equal(created.storageProvider, 'BLOB');
    assert.equal(created.ticketExpiresAt, null);
    assert.equal(created.objectKey, key);

    // Provider-specific lifecycle constraints must fail closed.
    await assert.rejects(prisma.privateMediaObject.update({
      where: { id }, data: { ticketExpiresAt: new Date(verifiedAt.getTime() + 100000) },
    }));
    await assert.rejects(prisma.privateMediaObject.update({
      where: { id }, data: { storageProvider: 'R2' },
    }));
    // Never allow an unversioned VERIFIED row.
    await assert.rejects(prisma.privateMediaObject.update({
      where: { id }, data: { verifiedEtag: null },
    }));
    // Verified items cannot be claimed by S3 pending cleanup.
    assert.equal((await prisma.privateMediaObject.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'REJECTED' },
    })).count, 0);
    assert.equal((await prisma.privateMediaObject.updateMany({
      where: { id, status: 'REJECTED' },
      data: { status: 'DELETED' },
    })).count, 0);
    process.stdout.write(
      'PASS: synthetic server-verified private Blob metadata and state constraints.\n',
    );
  } finally {
    await prisma.privateMediaObject.deleteMany({ where: { id } });
    await prisma.profile.deleteMany({ where: { id: actor } });
    await prisma.$disconnect();
  }
}
void main().catch(() => {
  process.stderr.write('Disposable verified Blob regression failed.\n');
  process.exitCode = 1;
});
