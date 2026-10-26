#!/usr/bin/env node
'use strict';

/**
 * Disposable PostgreSQL integration of the ACTUAL Prisma repository.
 * No Vercel credentials, no SDK, no DELETE, no Neon production database.
 */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

function verifyEnvironment(env) {
  if (env.NODE_ENV === 'production' ||
      env.SWIMFLOW_DISPOSABLE_DB !== 'yes') {
    throw new Error('Disposable database required');
  }
  for (const field of ['DATABASE_URL', 'DIRECT_URL']) {
    const url = new URL(env[field]);
    if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) ||
        url.pathname !== '/swimflow') {
      throw new Error('Refusing nonlocal database');
    }
  }
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  verifyEnvironment(process.env);
  const { PrismaClient } = require('@prisma/client');
  const { PrismaPrivateMediaObjectsRepository } = require(
    '../src/infra/database/prisma/repositories/prisma-private-media-objects-repository.ts'
  );
  const db = new PrismaClient({ log: [] });
  const concurrentDb = new PrismaClient({ log: [] });
  const repository = new PrismaPrivateMediaObjectsRepository(db);
  const otherRepository = new PrismaPrivateMediaObjectsRepository(concurrentDb);
  const actor = randomUUID();
  const resource = randomUUID();
  const youngResource = randomUUID();
  const raceResource = randomUUID();
  const oldId = randomUUID();
  const activeId = randomUUID();
  const youngId = randomUUID();
  const raceId = randomUUID();
  const allMedia = [oldId, activeId, youngId, raceId];
  const etag = '"abcdefabcdefabcdefabcdefabcdefab"';
  const now = new Date();
  const stale = new Date(now.getTime() - 35 * 86400000);
  const cutoff = new Date(now.getTime() - 30 * 86400000);

  const insert = (id, resourceId, date) =>
    db.privateMediaObject.create({
      data: {
        id,
        objectKey: `private/students/${resourceId}/${id}.jpg`,
        target: 'student-photo',
        resourceId,
        uploadedById: actor,
        uploadedByProfileId: actor,
        storageProvider: 'BLOB',
        status: 'VERIFIED',
        declaredContentType: 'image/jpeg',
        declaredSizeBytes: 100,
        ticketExpiresAt: null,
        verifiedEtag: etag,
        verifiedAt: date,
        createdAt: date,
      },
    });

  try {
    await db.profile.create({
      data: { id: actor, role: 'admin', fullName: 'Synthetic GC Claim CI' },
    });
    await insert(oldId, resource, stale);
    await insert(activeId, resource, stale);
    await insert(youngId, youngResource, now);
    await insert(raceId, raceResource, stale);
    await db.privateMediaActiveBinding.create({
      data: { target: 'student-photo', resourceId: resource, mediaId: activeId },
    });

    // A still-bound or too-young photograph must not be reserved.
    assert.equal(await repository.claimUnboundVerifiedBlobForCleanup(
      activeId, cutoff, now), false);
    assert.equal(await repository.claimUnboundVerifiedBlobForCleanup(
      youngId, cutoff, now), false);
    assert.equal(await repository.claimUnboundVerifiedBlobForCleanup(
      oldId, cutoff, now), true);
    assert.equal(await repository.claimUnboundVerifiedBlobForCleanup(
      oldId, cutoff, now), false);

    const claimed = await db.privateMediaObject.findUniqueOrThrow({
      where: { id: oldId },
    });
    assert.equal(claimed.status, 'GC_CLAIMED');
    assert.equal(claimed.storageProvider, 'BLOB');
    assert.equal(claimed.verifiedEtag, etag);
    assert(claimed.cleanupClaimedAt instanceof Date);

    // FK + lifecycle CHECK: no one may bind a claimed image or claim one
    // with a missing claim timestamp.
    await assert.rejects(db.privateMediaActiveBinding.update({
      where: {
        target_resourceId: { target: 'student-photo', resourceId: resource },
      },
      data: { mediaId: oldId },
    }));
    await assert.rejects(db.privateMediaObject.update({
      where: { id: youngId },
      data: { status: 'GC_CLAIMED' },
    }));
    await assert.rejects(db.privateMediaObject.update({
      where: { id: activeId },
      data: { status: 'GC_CLAIMED', cleanupClaimedAt: now },
    }));

    // Completion is a separate CAS: strong ETag and exact claim timestamp.
    assert.equal(await repository.completeClaimedBlobCleanup(
      oldId, '"wrong-etag"', claimed.cleanupClaimedAt, now,
    ), false);
    assert.equal(await repository.completeClaimedBlobCleanup(
      oldId, etag, new Date(claimed.cleanupClaimedAt.getTime() + 1), now,
    ), false);
    assert.equal(await repository.completeClaimedBlobCleanup(
      activeId, etag, now, now,
    ), false);
    assert.equal(await repository.completeClaimedBlobCleanup(
      oldId, etag, claimed.cleanupClaimedAt, now,
    ), true);
    assert.equal(await repository.completeClaimedBlobCleanup(
      oldId, etag, claimed.cleanupClaimedAt, now,
    ), false);
    const completed = await db.privateMediaObject.findUniqueOrThrow({
      where: { id: oldId },
    });
    assert.equal(completed.status, 'DELETED');
    assert.equal(completed.verifiedEtag, etag);
    assert.equal(completed.cleanupClaimedAt.getTime(), claimed.cleanupClaimedAt.getTime());
    assert.equal(completed.cleanupCompletedAt.getTime(), now.getTime());
    await assert.rejects(db.privateMediaActiveBinding.update({
      where: {
        target_resourceId: { target: 'student-photo', resourceId: resource },
      },
      data: { mediaId: oldId },
    }));
    await assert.rejects(db.privateMediaObject.update({
      where: { id: youngId },
      data: { status: 'DELETED', cleanupCompletedAt: now },
    }));

    // Deterministic reverse race: hold FOR UPDATE, then insert the FK
    // binding inside the holder's transaction; a concurrent real claim
    // must block, then observe the new active link and refuse the claim.
    let notifyLocked;
    let releaseLock;
    const locked = new Promise((resolve) => { notifyLocked = resolve; });
    const release = new Promise((resolve) => { releaseLock = resolve; });
    const holder = db.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM "private_media_objects"
        WHERE id = ${raceId}::uuid FOR UPDATE
      `;
      notifyLocked();
      await release;
      await tx.privateMediaActiveBinding.create({
        data: {
          target: 'student-photo',
          resourceId: raceResource,
          mediaId: raceId,
        },
      });
    }, { timeout: 15000 });
    try {
      await locked;
      const racingClaim = otherRepository.claimUnboundVerifiedBlobForCleanup(
        raceId, cutoff, now,
      );
      const status = await Promise.race([
        racingClaim.then(() => 'settled', () => 'settled'),
        pause(150).then(() => 'blocked'),
      ]);
      assert.equal(status, 'blocked');
      releaseLock();
      await holder;
      assert.equal(await racingClaim, false);
    } finally {
      releaseLock();
      await holder.catch(() => undefined);
    }
    assert.equal((await db.privateMediaObject.findUniqueOrThrow({
      where: { id: raceId },
    })).status, 'VERIFIED');
    assert.equal((await db.privateMediaActiveBinding.findUniqueOrThrow({
      where: {
        target_resourceId: {
          target: 'student-photo',
          resourceId: raceResource,
        },
      },
    })).mediaId, raceId);
    process.stdout.write(
      'PASS: Blob GC parent-row lock, retention, FK race and no remote delete.\n',
    );
  } finally {
    await db.privateMediaActiveBinding.deleteMany({
      where: { mediaId: { in: allMedia } },
    });
    await db.privateMediaObject.deleteMany({
      where: { id: { in: allMedia } },
    });
    await db.profile.deleteMany({ where: { id: actor } });
    await concurrentDb.$disconnect();
    await db.$disconnect();
  }
}
void main().catch((error) => {
  process.stderr.write('TEMP_DIAGNOSTIC_GC:' + String(error?.name || 'Error') + ':' + String(error?.code || 'none') + ':' + String(error?.message || '').slice(0,900) + '\n');
  process.stderr.write('Disposable Blob GC claim integrity test failed.\n');
  process.exitCode = 1;
});
