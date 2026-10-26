import type { PrivateBlobStorageRepository } from '../repositories/private-blob-storage-repository';
import type { PrivateMediaObjectsRepository } from '../repositories/private-media-objects-repository';
import { ReconcileClaimedPrivateBlobImageUseCase } from './reconcile-claimed-private-blob-image';

const ID = '11111111-1111-4111-8111-111111111111';
const OWNER = '22222222-2222-4222-8222-222222222222';
const PATH = `private/students/${OWNER}/${ID}.jpg`;
const ETAG = '"abcdeabcdeabcdeabcdeabcde1234567"';
const CLAIMED = new Date('2026-10-01T12:00:00Z');
const NOW = new Date('2026-10-26T12:00:00Z');
const record = {
  id: ID,
  objectKey: PATH,
  target: 'student-photo',
  resourceId: OWNER,
  storageProvider: 'BLOB',
  status: 'GC_CLAIMED',
  verifiedEtag: ETAG,
  cleanupClaimedAt: CLAIMED,
  cleanupCompletedAt: null,
};
const remote = {
  pathname: PATH, etag: ETAG, sizeBytes: 512, contentType: 'image/jpeg',
};
function setup() {
  const records = {
    findById: jest.fn().mockResolvedValue({ ...record }),
    completeClaimedBlobCleanup: jest.fn().mockResolvedValue(true),
  };
  const blobs = {
    stat: jest.fn().mockResolvedValueOnce(remote).mockResolvedValueOnce(null),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  return {
    records, blobs,
    run: new ReconcileClaimedPrivateBlobImageUseCase(
      records as unknown as PrivateMediaObjectsRepository,
      blobs as unknown as PrivateBlobStorageRepository,
    ),
  };
}
describe('Internal-only Blob GC reconciliation — all remote operations mocked', () => {
  it('deletes exactly the claimed ETag and marks complete only after confirmed 404', async () => {
    const x = setup();
    await expect(x.run.execute(ID, NOW)).resolves.toEqual({ status: 'COMPLETED' });
    expect(x.blobs.delete).toHaveBeenCalledWith(PATH, ETAG);
    expect(x.blobs.stat).toHaveBeenCalledTimes(2);
    expect(x.records.completeClaimedBlobCleanup).toHaveBeenCalledWith(
      ID, ETAG, CLAIMED, NOW,
    );
  });
  it('recovers from completed remote deletion without replaying DELETE', async () => {
    const x = setup();
    x.blobs.stat.mockReset().mockResolvedValue(null);
    await expect(x.run.execute(ID, NOW)).resolves.toEqual({ status: 'COMPLETED' });
    expect(x.blobs.delete).not.toHaveBeenCalled();
    expect(x.blobs.stat).toHaveBeenCalledTimes(2);
  });
  it('never finalizes on changed ETag, pending deletion or network errors', async () => {
    const changed = setup();
    changed.blobs.stat.mockReset().mockResolvedValue({
      ...remote, etag: '"different123"',
    });
    await expect(changed.run.execute(ID, NOW)).rejects.toThrow(
      'private-blob-cleanup-etag-conflict',
    );
    expect(changed.blobs.delete).not.toHaveBeenCalled();
    expect(changed.records.completeClaimedBlobCleanup).not.toHaveBeenCalled();

    const stillThere = setup();
    stillThere.blobs.stat.mockReset().mockResolvedValue(remote);
    await expect(stillThere.run.execute(ID, NOW)).rejects.toThrow(
      'private-blob-cleanup-not-confirmed',
    );
    expect(stillThere.records.completeClaimedBlobCleanup).not.toHaveBeenCalled();

    const offline = setup();
    offline.blobs.delete.mockRejectedValueOnce(new Error('network unavailable'));
    await expect(offline.run.execute(ID, NOW)).rejects.toThrow('network unavailable');
    expect(offline.records.completeClaimedBlobCleanup).not.toHaveBeenCalled();
  });
  it('does not access Blob for R2, VERIFIED, absent or malformed claims', async () => {
    for (const item of [
      { ...record, storageProvider: 'R2' },
      { ...record, status: 'VERIFIED' },
      { ...record, cleanupClaimedAt: null },
      null,
    ]) {
      const x = setup();
      x.records.findById.mockResolvedValueOnce(item);
      await expect(x.run.execute(ID, NOW)).resolves.toEqual({
        status: 'NOT_ELIGIBLE',
      });
      expect(x.blobs.stat).not.toHaveBeenCalled();
      expect(x.blobs.delete).not.toHaveBeenCalled();
    }
    const x = setup();
    await expect(x.run.execute('../invalid', NOW)).rejects.toThrow(
      'invalid-private-blob-cleanup-reconciliation',
    );
    expect(x.records.findById).not.toHaveBeenCalled();
  });
  it('is idempotent for completed claims and handles losing DB races', async () => {
    const completed = setup();
    completed.records.findById.mockResolvedValueOnce({
      ...record, status: 'DELETED', cleanupCompletedAt: NOW,
    });
    await expect(completed.run.execute(ID, NOW)).resolves.toEqual({
      status: 'ALREADY_COMPLETED',
    });
    expect(completed.blobs.stat).not.toHaveBeenCalled();

    const race = setup();
    race.records.completeClaimedBlobCleanup.mockResolvedValueOnce(false);
    race.records.findById.mockResolvedValueOnce(record).mockResolvedValueOnce({
      ...record, status: 'DELETED', cleanupCompletedAt: NOW,
    });
    await expect(race.run.execute(ID, NOW)).resolves.toEqual({
      status: 'ALREADY_COMPLETED',
    });
    const lost = setup();
    lost.records.completeClaimedBlobCleanup.mockResolvedValueOnce(false);
    await expect(lost.run.execute(ID, NOW)).rejects.toThrow(
      'private-blob-cleanup-finalization-race',
    );
  });
});
