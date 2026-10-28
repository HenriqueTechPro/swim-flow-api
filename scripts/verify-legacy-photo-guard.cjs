#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaClient, SwimmingCategory } = require('@prisma/client');
const { assertLegacyPhotoWriteAllowed } = require(
  '../src/infra/database/prisma/repositories/legacy-photo-write-guard'
);
const { PrismaPrivateMediaObjectsRepository } = require(
  '../src/infra/database/prisma/repositories/prisma-private-media-objects-repository'
);

function requireDisposable(env) {
  if (env.SWIMFLOW_DISPOSABLE_DB !== 'yes' || env.NODE_ENV === 'production') {
    throw new Error('Disposable PostgreSQL approval required');
  }
  for (const key of ['DIRECT_URL', 'DATABASE_URL']) {
    const parsed = new URL(env[key]);
    if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname) ||
        parsed.pathname !== '/swimflow') {
      throw new Error('Refusing to touch non-disposable database');
    }
  }
}

async function main() {
  requireDisposable(process.env);
  const prisma = new PrismaClient();
  const records = new PrismaPrivateMediaObjectsRepository(prisma);
  const ids = {
    profile: randomUUID(), student: randomUUID(),
    teacher: randomUUID(), parent: randomUUID(),
    category: randomUUID(), level: randomUUID(),
  };
  const LEGACY = 'https://legacy.example.invalid/old.jpg';
  const ATTACK = 'https://legacy.example.invalid/reintroduced.jpg';
  const mediaIds = [];
  const targets = [
    ['profile-avatar', ids.profile, 'profile', 'avatarUrl'],
    ['student-photo', ids.student, 'student', 'photo'],
    ['teacher-photo', ids.teacher, 'teacher', 'photo'],
    ['parent-photo', ids.parent, 'parent', 'photo'],
  ];
  const etag = '"aabbccddeeff00112233445566778899"';

  async function insertMedia(target, resourceId) {
    const id = randomUUID();
    mediaIds.push(id);
    await prisma.privateMediaObject.create({
      data: {
        id,
        objectKey: 'private/' + ({
          'profile-avatar': 'profiles',
          'student-photo': 'students',
          'teacher-photo': 'teachers',
          'parent-photo': 'parents',
        })[target] + '/' + resourceId + '/' + id + '.jpg',
        target, resourceId,
        uploadedById: ids.profile,
        uploadedByProfileId: ids.profile,
        declaredContentType: 'image/jpeg',
        declaredSizeBytes: 4,
        storageProvider: 'BLOB',
        status: 'VERIFIED',
        verifiedAt: new Date(),
        verifiedEtag: etag,
        ticketExpiresAt: null,
      },
    });
    return id;
  }

  try {
    await prisma.profile.create({
      data: {
        id: ids.profile, fullName: 'Photo Guard CI', role: 'admin',
        avatarUrl: LEGACY,
      },
    });
    await prisma.category.create({
      data: { id: ids.category, name: Object.values(SwimmingCategory)[0] },
    });
    await prisma.level.create({
      data: { id: ids.level, name: 'Photo-guard CI ' + ids.level },
    });
    await prisma.student.create({
      data: {
        id: ids.student, name: 'Student photo guard CI',
        categoryId: ids.category, levelId: ids.level, photo: LEGACY,
      },
    });
    await prisma.teacher.create({
      data: { id: ids.teacher, name: 'Teacher photo guard CI', photo: LEGACY },
    });
    await prisma.parent.create({
      data: { id: ids.parent, name: 'Parent photo guard CI', photo: LEGACY },
    });

    for (const [target, resourceId, delegate, field] of targets) {
      // No private image yet: legacy upload still works.
      await prisma.$transaction(async (tx) => {
        await assertLegacyPhotoWriteAllowed(tx, target, resourceId, LEGACY);
      });

      const mediaId = await insertMedia(target, resourceId);
      assert.equal(await records.commitPrivateBlobBinding({
        target, resourceId,
        newMediaId: mediaId,
        expectedMediaId: null,
        expectedLegacyUrl: LEGACY,
      }), true);
      assert.equal((await prisma[delegate].findUniqueOrThrow({
        where: { id: resourceId },
      }))[field], null);

      // Non-null photo write MUST abort before updating other fields.
      await assert.rejects(
        prisma.$transaction(async (tx) => {
          await assertLegacyPhotoWriteAllowed(tx, target, resourceId, ATTACK);
          await tx[delegate].update({
            where: { id: resourceId },
            data: { [field]: ATTACK },
          });
        }),
        (error) => error.statusCode === 409,
      );
      assert.equal((await prisma[delegate].findUniqueOrThrow({
        where: { id: resourceId },
      }))[field], null);

      // Null photo changes remain valid for ordinary form edits.
      await prisma.$transaction(async (tx) => {
        await assertLegacyPhotoWriteAllowed(tx, target, resourceId, null);
        await tx[delegate].update({
          where: { id: resourceId },
          data: { [field]: null },
        });
      });
      assert.equal(await records.commitPrivateBlobBinding({
        target, resourceId,
        newMediaId: null,
        expectedMediaId: mediaId,
        expectedLegacyUrl: null,
      }), true);

      // After explicit private removal, public URL writes remain backward
      // compatible until the entity is migrated again.
      await prisma.$transaction(async (tx) => {
        await assertLegacyPhotoWriteAllowed(tx, target, resourceId, LEGACY);
        await tx[delegate].update({
          where: { id: resourceId },
          data: { [field]: LEGACY },
        });
      });
    }

    // Simulate /commit holding the owner row while a legacy edit is queued:
    // the legacy transaction must wait then see the NEW binding, not a stale
    // pre-lock snapshot. This is the race that the old code allowed.
    const actor = ids.profile;
    const pendingMedia = await insertMedia('profile-avatar', actor);
    let signalLocked;
    const locked = new Promise((resolve) => { signalLocked = resolve; });
    let releaseLock;
    const release = new Promise((resolve) => { releaseLock = resolve; });
    const commit = prisma.$transaction(async (tx) => {
      const changed = await tx.profile.updateMany({
        where: { id: actor, avatarUrl: LEGACY },
        data: { avatarUrl: null },
      });
      assert.equal(changed.count, 1);
      signalLocked();
      await release;
      await tx.privateMediaActiveBinding.create({
        data: {
          target: 'profile-avatar',
          resourceId: actor,
          mediaId: pendingMedia,
          storageProvider: 'BLOB',
          status: 'VERIFIED',
        },
      });
    }, { timeout: 10000 });
    await locked;
    const staleWriter = prisma.$transaction(async (tx) => {
      await assertLegacyPhotoWriteAllowed(tx, 'profile-avatar', actor, ATTACK);
      await tx.profile.update({
        where: { id: actor },
        data: { avatarUrl: ATTACK },
      });
    }, { timeout: 10000 });
    const staleResult = staleWriter.then(
      () => ({ rejected: false }),
      (error) => ({ rejected: true, error }),
    );
    // Ensure the legacy transaction has a chance to request the row lock
    // while the commit still holds it.
    await new Promise((resolve) => setTimeout(resolve, 25));
    releaseLock();
    await commit;
    const result = await staleResult;
    assert.equal(result.rejected, true);
    assert.equal(result.error.statusCode, 409);
    const profile = await prisma.profile.findUniqueOrThrow({
      where: { id: actor },
      select: { avatarUrl: true },
    });
    assert.equal(profile.avatarUrl, null);

    process.stdout.write(
      'PASS: all four photo targets, legacy compatibility, null edits, and concurrent lock serialization.\n'
    );
  } finally {
    await prisma.privateMediaActiveBinding.deleteMany({
      where: { resourceId: { in: Object.values(ids) } },
    });
    await prisma.privateMediaObject.deleteMany({ where: { id: { in: mediaIds } } });
    await prisma.student.deleteMany({ where: { id: ids.student } });
    await prisma.teacher.deleteMany({ where: { id: ids.teacher } });
    await prisma.parent.deleteMany({ where: { id: ids.parent } });
    await prisma.category.deleteMany({ where: { id: ids.category } });
    await prisma.level.deleteMany({ where: { id: ids.level } });
    await prisma.profile.deleteMany({ where: { id: ids.profile } });
    await prisma.$disconnect();
  }
}
void main().catch((error) => {
  process.stderr.write('Legacy photo guard synthetic integration failed.\n');
  if (error && error.code) process.stderr.write('Postgres error: ' + error.code + '\n');
  process.exitCode = 1;
});
