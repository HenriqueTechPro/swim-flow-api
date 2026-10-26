import type { PrivateMediaObjectsRepository } from '../repositories/private-media-objects-repository';
import type { PrivateMediaStorageRepository } from '../repositories/private-media-storage-repository';
import { CleanupPrivateMediaUploadsUseCase } from './cleanup-private-media-uploads';

const NOW = new Date('2026-10-25T17:00:00.000Z');
const EXPIRY = new Date('2026-10-25T16:57:00.000Z');
const pending = {
  id: '33333333-3333-4333-8333-333333333333',
  status: 'PENDING' as const,
  storageProvider: 'R2' as const,
  objectKey:
    'private/profiles/11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333.png',
  ticketExpiresAt: EXPIRY,
};

function setup() {
  const objects = {
    listCleanupCandidates: jest.fn().mockResolvedValue([pending]),
    rejectIfPending: jest.fn().mockResolvedValue(true),
    markDeletedIfRejected: jest.fn().mockResolvedValue(true),
  };
  const storage = { deleteObject: jest.fn().mockResolvedValue(undefined) };
  const useCase = new CleanupPrivateMediaUploadsUseCase(
    objects as unknown as PrivateMediaObjectsRepository,
    storage as unknown as PrivateMediaStorageRepository,
  );
  return { useCase, objects, storage };
}

describe('Private media orphan cleanup (no live bucket)', () => {
  it('atomically claims PENDING before deleting private bytes', async () => {
    const api = setup();
    expect(await api.useCase.execute(NOW)).toEqual({
      inspected: 1,
      deleted: 1,
      failed: 0,
    });
    expect(api.objects.listCleanupCandidates).toHaveBeenCalledWith(
      new Date('2026-10-25T16:58:00.000Z'),
      25,
    );
    expect(api.objects.rejectIfPending).toHaveBeenCalledWith(
      pending.id,
      new Date('2026-10-25T16:58:00.000Z'),
    );
    expect(api.storage.deleteObject).toHaveBeenCalledWith(pending.objectKey);
    expect(api.objects.markDeletedIfRejected).toHaveBeenCalledWith(pending.id);
    expect(
      api.objects.rejectIfPending.mock.invocationCallOrder[0],
    ).toBeLessThan(api.storage.deleteObject.mock.invocationCallOrder[0]);
  });

  it('never deletes a row already claimed by concurrent verification', async () => {
    const api = setup();
    api.objects.rejectIfPending.mockResolvedValue(false);
    expect(await api.useCase.execute(NOW)).toEqual({
      inspected: 1,
      deleted: 0,
      failed: 0,
    });
    expect(api.storage.deleteObject).not.toHaveBeenCalled();
  });

  it('retries REJECTED rows and moves to DELETED only after S3 success', async () => {
    const api = setup();
    api.objects.listCleanupCandidates.mockResolvedValue([
      { ...pending, status: 'REJECTED' },
    ]);
    api.storage.deleteObject.mockRejectedValueOnce(new Error('timeout'));
    expect(await api.useCase.execute(NOW)).toEqual({
      inspected: 1,
      deleted: 0,
      failed: 1,
    });
    expect(api.objects.markDeletedIfRejected).not.toHaveBeenCalled();
    expect(await api.useCase.execute(NOW)).toEqual({
      inspected: 1,
      deleted: 1,
      failed: 0,
    });
    expect(api.objects.rejectIfPending).not.toHaveBeenCalled();
  });

  it('never tries to delete verified objects even if a fake returns them', async () => {
    const api = setup();
    api.objects.listCleanupCandidates.mockResolvedValue([
      { ...pending, status: 'VERIFIED' },
    ]);
    expect(await api.useCase.execute(NOW)).toEqual({
      inspected: 1,
      deleted: 0,
      failed: 0,
    });
    expect(api.storage.deleteObject).not.toHaveBeenCalled();
  });

  it('isolates failures across independent objects', async () => {
    const api = setup();
    api.objects.listCleanupCandidates.mockResolvedValue([
      pending,
      {
        ...pending,
        id: '44444444-4444-4444-8444-444444444444',
        status: 'REJECTED',
      },
    ]);
    api.storage.deleteObject.mockRejectedValueOnce(new Error('network'));
    expect(await api.useCase.execute(NOW)).toEqual({
      inspected: 2,
      deleted: 1,
      failed: 1,
    });
    expect(api.objects.markDeletedIfRejected).toHaveBeenCalledTimes(1);
  });
});
