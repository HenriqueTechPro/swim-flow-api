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
};

describe('Prisma private media compare-and-swap transitions', () => {
  const prisma = {
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

  it('atomically verifies only PENDING whose PUT grace is over', async () => {
    prisma.privateMediaObject.updateMany.mockResolvedValue({ count: 1 });
    expect(
      await repository.markVerifiedIfPending(UUID, CUTOFF, VERIFIED_AT, ETAG),
    ).toBe(true);
    expect(prisma.privateMediaObject.updateMany).toHaveBeenCalledWith({
      where: { id: UUID, status: 'PENDING', ticketExpiresAt: { lte: CUTOFF } },
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
      where: { id: UUID, status: 'REJECTED' },
      data: { status: 'DELETED' },
    });
  });
});
