import type { Prisma } from '@prisma/client';
import { assertLegacyPhotoWriteAllowed } from './legacy-photo-write-guard';

const ID = '11111111-1111-4111-8111-111111111111';
const LEGACY = 'https://legacy.example.invalid/photo.jpg';
const targets = [
  'profile-avatar',
  'student-photo',
  'teacher-photo',
  'parent-photo',
] as const;

describe('02F-06B3F — legacy photo writer database guard', () => {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: ID }]),
    privateMediaActiveBinding: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tx.$queryRaw.mockResolvedValue([{ id: ID }]);
    tx.privateMediaActiveBinding.findUnique.mockResolvedValue(null);
  });

  it.each(targets)(
    'rejects a non-null legacy URL on active %s',
    async (target) => {
      tx.privateMediaActiveBinding.findUnique.mockResolvedValue({
        mediaId: ID,
      });
      await expect(
        assertLegacyPhotoWriteAllowed(
          tx as unknown as Prisma.TransactionClient,
          target,
          ID,
          LEGACY,
        ),
      ).rejects.toMatchObject({
        statusCode: 409,
      });
      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(tx.privateMediaActiveBinding.findUnique).toHaveBeenCalledWith({
        where: { target_resourceId: { target, resourceId: ID } },
        select: { mediaId: true },
      });
      expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        tx.privateMediaActiveBinding.findUnique.mock.invocationCallOrder[0],
      );
    },
  );

  it.each(targets)('allows %s before private adoption', async (target) => {
    await expect(
      assertLegacyPhotoWriteAllowed(
        tx as unknown as Prisma.TransactionClient,
        target,
        ID,
        LEGACY,
      ),
    ).resolves.toBeUndefined();
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.privateMediaActiveBinding.findUnique).toHaveBeenCalledTimes(1);
  });

  it('does not query the binding or lock a row for null/omitted photos', async () => {
    for (const photo of [null, undefined, '']) {
      await expect(
        assertLegacyPhotoWriteAllowed(
          tx as unknown as Prisma.TransactionClient,
          'profile-avatar',
          ID,
          photo,
        ),
      ).resolves.toBeUndefined();
    }
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.privateMediaActiveBinding.findUnique).not.toHaveBeenCalled();
  });

  it('lets missing-record handling remain the existing 404 path', async () => {
    tx.$queryRaw.mockResolvedValue([]);
    await expect(
      assertLegacyPhotoWriteAllowed(
        tx as unknown as Prisma.TransactionClient,
        'student-photo',
        ID,
        LEGACY,
      ),
    ).resolves.toBeUndefined();
    expect(tx.privateMediaActiveBinding.findUnique).not.toHaveBeenCalled();
  });

  it('propagates database failures instead of turning them into a fake CAS conflict', async () => {
    tx.$queryRaw.mockRejectedValueOnce(new Error('db-down'));
    await expect(
      assertLegacyPhotoWriteAllowed(
        tx as unknown as Prisma.TransactionClient,
        'student-photo',
        ID,
        LEGACY,
      ),
    ).rejects.toThrow('db-down');
  });
});
