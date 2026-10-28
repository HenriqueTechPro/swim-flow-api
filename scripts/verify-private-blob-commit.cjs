#!/usr/bin/env node
'use strict';
// Synthetic disposable CI Postgres only. Never connects to Neon, Render or Blob.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { PrismaPrivateMediaObjectsRepository } = require('../src/infra/database/prisma/repositories/prisma-private-media-objects-repository');

function requireDisposable(env) {
  if (env.SWIMFLOW_DISPOSABLE_DB !== 'yes' || env.NODE_ENV === 'production') {
    throw new Error('Disposable database approval required');
  }
  for (const key of ['DIRECT_URL', 'DATABASE_URL']) {
    const parsed = new URL(env[key]);
    if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname) ||
        parsed.pathname !== '/swimflow') {
      throw new Error('Refusing a non-disposable database');
    }
  }
}

async function main() {
  requireDisposable(process.env);
  const prisma = new PrismaClient();
  const records = new PrismaPrivateMediaObjectsRepository(prisma);
  const actor = randomUUID();
  const foreign = randomUUID();
  const first = randomUUID();
  const second = randomUUID();
  const third = randomUUID();
  const foreignMedia = randomUUID();
  const etag = '"aabbccddeeff00112233445566778899"';
  const legacy = 'https://legacy.example.invalid/ci-avatar.jpg';
  const override = 'https://legacy.example.invalid/updated.jpg';
  const expected = {
    target: 'profile-avatar',
    resourceId: actor,
    expectedLegacyUrl: legacy,
    expectedMediaId: null,
  };
  const refs = [first, second, third, foreignMedia];

  const media = (id, owner) => prisma.privateMediaObject.create({
    data: {
      id,
      objectKey: 'private/profiles/' + owner + '/' + id + '.jpg',
      target: 'profile-avatar',
      resourceId: owner,
      uploadedById: actor,
      uploadedByProfileId: actor,
      declaredContentType: 'image/jpeg',
      declaredSizeBytes: 4,
      storageProvider: 'BLOB',
      status: 'VERIFIED',
      verifiedAt: new Date(),
      verifiedEtag: etag,
      ticketExpiresAt: null,
    },
  });

  const profile = () => prisma.profile.findUniqueOrThrow({
    where: { id: actor },
    select: { avatarUrl: true },
  });
  const binding = () => prisma.privateMediaActiveBinding.findUnique({
    where: {
      target_resourceId: { target: 'profile-avatar', resourceId: actor },
    },
    select: { mediaId: true },
  });

  try {
    await prisma.profile.create({
      data: { id: actor, role: 'user', fullName: 'Synthetic CI', avatarUrl: legacy },
    });
    await prisma.profile.create({
      data: { id: foreign, role: 'user', fullName: 'Foreign synthetic CI' },
    });
    await media(first, actor);
    await media(second, actor);
    await media(third, actor);
    await media(foreignMedia, foreign);

    assert.equal(await records.commitPrivateBlobBinding({
      ...expected, expectedLegacyUrl: 'stale', newMediaId: first,
    }), false);
    assert.equal((await profile()).avatarUrl, legacy);
    assert.equal(await binding(), null);

    assert.equal(await records.commitPrivateBlobBinding({
      ...expected, newMediaId: first,
    }), true);
    assert.equal((await profile()).avatarUrl, null);
    assert.equal((await binding()).mediaId, first);

    await prisma.profile.update({
      where: { id: actor },
      data: { avatarUrl: override },
    });
    assert.equal(await records.commitPrivateBlobBinding({
      ...expected,
      expectedLegacyUrl: null,
      expectedMediaId: first,
      newMediaId: second,
    }), false);
    assert.equal((await profile()).avatarUrl, override);
    assert.equal((await binding()).mediaId, first);

    assert.equal(await records.commitPrivateBlobBinding({
      ...expected,
      expectedLegacyUrl: override,
      expectedMediaId: first,
      newMediaId: second,
    }), true);
    assert.equal((await profile()).avatarUrl, null);
    assert.equal((await binding()).mediaId, second);

    assert.equal(await records.commitPrivateBlobBinding({
      ...expected,
      expectedLegacyUrl: null,
      expectedMediaId: first,
      newMediaId: third,
    }), false);
    assert.equal((await binding()).mediaId, second);
    assert.equal((await profile()).avatarUrl, null);

    // Cross-resource FK error MUST undo the legacy clear in the transaction.
    await prisma.profile.update({
      where: { id: actor },
      data: { avatarUrl: override },
    });
    await assert.rejects(records.commitPrivateBlobBinding({
      ...expected,
      expectedLegacyUrl: override,
      expectedMediaId: second,
      newMediaId: foreignMedia,
    }));
    assert.equal((await binding()).mediaId, second);
    assert.equal((await profile()).avatarUrl, override);

    assert.equal(await records.commitPrivateBlobBinding({
      ...expected,
      expectedLegacyUrl: override,
      expectedMediaId: first,
      newMediaId: null,
    }), false);
    assert.equal((await profile()).avatarUrl, override);
    assert.equal((await binding()).mediaId, second);

    assert.equal(await records.commitPrivateBlobBinding({
      ...expected,
      expectedLegacyUrl: override,
      expectedMediaId: second,
      newMediaId: null,
    }), true);
    assert.equal(await binding(), null);
    assert.equal((await profile()).avatarUrl, null);
    assert.equal(await records.commitPrivateBlobBinding({
      ...expected, expectedLegacyUrl: null, expectedMediaId: second,
      newMediaId: null,
    }), false);
    assert.equal(await prisma.privateMediaObject.count({
      where: { id: { in: refs }, status: 'VERIFIED' },
    }), 4);

    process.stdout.write('PASS: atomic photo CAS, legacy rollback, replacement, removal and FK safety.\n');
  } finally {
    await prisma.privateMediaActiveBinding.deleteMany({
      where: { target: 'profile-avatar', resourceId: { in: [actor, foreign] } },
    });
    await prisma.privateMediaObject.deleteMany({ where: { id: { in: refs } } });
    await prisma.profile.deleteMany({ where: { id: { in: [actor, foreign] } } });
    await prisma.$disconnect();
  }
}
void main().catch((error) => {
  process.stderr.write('Synthetic private photo commit verification failed.\n');
  if (error && error.code) process.stderr.write('Database error: ' + error.code + '\n');
  process.exitCode = 1;
});
