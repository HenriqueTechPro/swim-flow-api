import type { PrismaService } from '../prisma.service';
import { PrismaPrivateMediaObjectsRepository } from './prisma-private-media-objects-repository';

const UUID = '33333333-3333-4333-8333-333333333333';
const EXPIRY = new Date('2026-10-25T16:57:00.000Z');
const CUTOFF = new Date('2026-10-25T16:58:00.000Z');
const ETAG = '"d41d8cd98f00b204e9800998ecf8427e"';
const VERIFIED_AT = new Date('2026-10-25T17:00:00.000Z');

const row = {
  id: UUID,
  objectKey:
    'private/students/22222222-2222-4222-8222-222222222222/' + UUID + '.png',
  target: 'student-photo',
  resourceId: '22222222-2222-4222-8222-222222222222',
  uploadedById: '11111111-1111-4111-8111-111111111111',
  declaredContentType: 'image/png',
  declaredSizeBytes: 100,
  ticketExpiresAt: EXPIRY,
  verifiedAt: null,
  verifiedEtag: null,
  status: 'PENDING',
  storageProvider: 'R2',
};

describe('Prisma private media compare-and-swap transitions', () => {
  const prisma = {
    privateMediaActiveBinding: {
      create: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    privateMediaObject: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const repository = new PrismaPrivateMediaObjectsRepository(
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('fetches safe metadata without signing an S3 credential', async () => {
    prisma.privateMediaObject.findUnique.mockResolvedValue(row);
    expect(await repository.findById(UUID)).toMatchObject({
      id: UUID,
      target: 'student-photo',
      status: 'PENDING',
      objectKey: row.objectKey,
    });
    expect(prisma.privateMediaObject.findUnique).toHaveBeenCalledWith({
      where: { id: UUID },
    });
  });

  it('inserts server-processed Vercel Blob metadata as VERIFIED atomically', async () => {
    prisma.privateMediaObject.create.mockResolvedValue({ id: UUID });
    await repository.createVerifiedBlob({
      id: UUID,
      objectKey: row.objectKey.replace('.png', '.jpg'),
      target: 'student-photo',
      resourceId: row.resourceId,
      uploadedById: row.uploadedById,
      declaredContentType: 'image/jpeg',
      declaredSizeBytes: 500,
      verifiedAt: VERIFIED_AT,
      verifiedEtag: ETAG,
    });
    expect(prisma.privateMediaObject.create).toHaveBeenCalledWith({
      data: {
        id: UUID,
        objectKey: row.objectKey.replace('.png', '.jpg'),
        target: 'student-photo',
        resourceId: row.resourceId,
        uploadedById: row.uploadedById,
        uploadedByProfileId: row.uploadedById,
        declaredContentType: 'image/jpeg',
        declaredSizeBytes: 500,
        status: 'VERIFIED',
        storageProvider: 'BLOB',
        verifiedAt: VERIFIED_AT,
        verifiedEtag: ETAG,
        ticketExpiresAt: null,
      },
      select: { id: true },
    });
  });

  it('returns only the currently bound media ID for an exact resource', async () => {
    prisma.privateMediaActiveBinding.findUnique.mockResolvedValueOnce({
      mediaId: UUID,
    });
    expect(
      await repository.findActiveMediaId('student-photo', row.resourceId),
    ).toBe(UUID);
    expect(prisma.privateMediaActiveBinding.findUnique).toHaveBeenCalledWith({
      where: {
        target_resourceId: {
          target: 'student-photo',
          resourceId: row.resourceId,
        },
      },
      select: { mediaId: true },
    });
    prisma.privateMediaActiveBinding.findUnique.mockResolvedValueOnce(null);
    expect(
      await repository.findActiveMediaId('student-photo', row.resourceId),
    ).toBeNull();
  });

  it('assigns first Blob image only if there is no current binding', async () => {
    prisma.privateMediaActiveBinding.create.mockResolvedValue({
      mediaId: UUID,
    });
    const input = {
      target: 'student-photo' as const,
      resourceId: row.resourceId,
      mediaId: UUID,
      expectedMediaId: null,
    };
    expect(await repository.assignActiveVerifiedBlob(input)).toBe(true);
    expect(prisma.privateMediaActiveBinding.create).toHaveBeenCalledWith({
      data: {
        target: 'student-photo',
        resourceId: row.resourceId,
        mediaId: UUID,
        storageProvider: 'BLOB',
        status: 'VERIFIED',
      },
      select: { mediaId: true },
    });
    prisma.privateMediaActiveBinding.create.mockRejectedValueOnce({
      code: 'P2002',
    });
    expect(await repository.assignActiveVerifiedBlob(input)).toBe(false);
    prisma.privateMediaActiveBinding.create.mockRejectedValueOnce({
      code: 'P2003',
    });
    await expect(
      repository.assignActiveVerifiedBlob(input),
    ).rejects.toMatchObject({
      code: 'P2003',
    });
  });

  it('conditionally replaces only the expected old photo', async () => {
    prisma.privateMediaActiveBinding.updateMany.mockResolvedValue({ count: 1 });
    const input = {
      target: 'student-photo' as const,
      resourceId: row.resourceId,
      mediaId: UUID,
      expectedMediaId: '44444444-4444-4444-8444-444444444444',
    };
    expect(await repository.assignActiveVerifiedBlob(input)).toBe(true);
    expect(prisma.privateMediaActiveBinding.updateMany).toHaveBeenCalledWith({
      where: {
        target: input.target,
        resourceId: input.resourceId,
        mediaId: input.expectedMediaId,
      },
      data: { mediaId: input.mediaId },
    });
    prisma.privateMediaActiveBinding.updateMany.mockResolvedValueOnce({
      count: 0,
    });
    expect(await repository.assignActiveVerifiedBlob(input)).toBe(false);
  });

  it('scans only aged, unbound VERIFIED Blob metadata with a bounded query', async () => {
    const resultRow = {
      id: UUID,
      target: 'student-photo',
      declaredSizeBytes: 200,
      verifiedAt: VERIFIED_AT,
    };
    prisma.privateMediaObject.findMany.mockResolvedValue([resultRow]);
    expect(
      await repository.listUnboundVerifiedBlobCandidates(CUTOFF, 26),
    ).toEqual([resultRow]);
    expect(prisma.privateMediaObject.findMany).toHaveBeenCalledWith({
      where: {
        storageProvider: 'BLOB',
        status: 'VERIFIED',
        ticketExpiresAt: null,
        verifiedAt: { lte: CUTOFF },
        createdAt: { lte: CUTOFF },
        activeBindings: { none: {} },
      },
      orderBy: [{ verifiedAt: 'asc' }, { id: 'asc' }],
      take: 26,
      select: {
        id: true,
        target: true,
        declaredSizeBytes: true,
        verifiedAt: true,
      },
    });
    for (const limit of [-1, 0, 52, 1.5]) {
      await expect(
        repository.listUnboundVerifiedBlobCandidates(CUTOFF, limit),
      ).rejects.toThrow('invalid-private-blob-audit-query');
    }
    expect(prisma.privateMediaObject.findMany).toHaveBeenCalledTimes(1);
  });

  it('refuses to classify unverified metadata as a cleanup candidate', async () => {
    prisma.privateMediaObject.findMany.mockResolvedValueOnce([{
      id: UUID,
      target: 'student-photo',
      declaredSizeBytes: 100,
      verifiedAt: null,
    }]);
    await expect(
      repository.listUnboundVerifiedBlobCandidates(CUTOFF, 25),
    ).rejects.toThrow('invalid-private-blob-audit-metadata');
  });

  it('atomically verifies only PENDING whose PUT grace is over', async () => {
    prisma.privateMediaObject.updateMany.mockResolvedValue({ count: 1 });
    expect(
      await repository.markVerifiedIfPending(UUID, CUTOFF, VERIFIED_AT, ETAG),
    ).toBe(true);
    expect(prisma.privateMediaObject.updateMany).toHaveBeenCalledWith({
      where: {
        id: UUID,
        status: 'PENDING',
        storageProvider: 'R2',
        ticketExpiresAt: { lte: CUTOFF },
      },
      data: { status: 'VERIFIED', verifiedAt: VERIFIED_AT, verifiedEtag: ETAG },
    });
  });

  it('rejects ONLY eligible PENDING, never a concurrently VERIFIED object', async () => {
    prisma.privateMediaObject.updateMany.mockResolvedValue({ count: 0 });
    expect(await repository.rejectIfPending(UUID, CUTOFF)).toBe(false);
    expect(prisma.privateMediaObject.updateMany).toHaveBeenCalledWith({
      where: { id: UUID, status: 'PENDING', ticketExpiresAt: { lte: CUTOFF } },
      data: { status: 'REJECTED' },
    });
  });

  it('only queries expired pending or rejected for bounded orphan cleanup', async () => {
    prisma.privateMediaObject.findMany.mockResolvedValue([
      { ...row, status: 'REJECTED' },
    ]);
    const results = await repository.listCleanupCandidates(CUTOFF, 25);
    expect(results[0].status).toBe('REJECTED');
    expect(prisma.privateMediaObject.findMany).toHaveBeenCalledWith({
      where: {
        status: { in: ['PENDING', 'REJECTED'] },
        storageProvider: 'R2',
        ticketExpiresAt: { lte: CUTOFF },
      },
      take: 25,
      orderBy: [{ ticketExpiresAt: 'asc' }, { id: 'asc' }],
    });
    await expect(
      repository.listCleanupCandidates(CUTOFF, 1000),
    ).rejects.toThrow('invalid-private-media-cleanup-limit');
  });

  it('marks DELETED only if previous status is REJECTED', async () => {
    prisma.privateMediaObject.updateMany.mockResolvedValue({ count: 1 });
    expect(await repository.markDeletedIfRejected(UUID)).toBe(true);
    expect(prisma.privateMediaObject.updateMany).toHaveBeenCalledWith({
      where: { id: UUID, status: 'REJECTED', storageProvider: 'R2' },
      data: { status: 'DELETED' },
    });
  });
});
