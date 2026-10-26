import type { PrivateMediaObjectsRepository } from '../repositories/private-media-objects-repository';
import { ClaimUnboundPrivateBlobImageUseCase } from './claim-unbound-private-blob-image';

const MEDIA = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-10-26T12:00:00.000Z');
const CUTOFF = new Date('2026-09-26T12:00:00.000Z');

function setup(claimed = true) {
  const records = {
    claimUnboundVerifiedBlobForCleanup: jest.fn().mockResolvedValue(claimed),
  };
  const useCase = new ClaimUnboundPrivateBlobImageUseCase(
    records as unknown as PrivateMediaObjectsRepository,
  );
  return { useCase, records };
}

describe('Internal-only atomic cleanup claim (NO Blob calls)', () => {
  it('reserves metadata after a hard 30-day retention and no physical delete', async () => {
    const { useCase, records } = setup();
    expect(await useCase.execute(MEDIA, NOW)).toEqual({
      status: 'GC_CLAIMED',
      deletedObjects: 0,
    });
    expect(records.claimUnboundVerifiedBlobForCleanup).toHaveBeenCalledWith(
      MEDIA,
      CUTOFF,
      NOW,
    );
  });

  it('returns no eligibility for bound, young or already claimed records', async () => {
    const { useCase, records } = setup(false);
    expect(await useCase.execute(MEDIA, NOW)).toEqual({
      status: 'NOT_ELIGIBLE',
      deletedObjects: 0,
    });
    expect(records.claimUnboundVerifiedBlobForCleanup).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed IDs or dates without contacting storage or DB', async () => {
    const { useCase, records } = setup();
    await expect(useCase.execute('../path', NOW)).rejects.toThrow(
      'invalid-private-blob-cleanup-claim',
    );
    await expect(useCase.execute(MEDIA, new Date('bad'))).rejects.toThrow(
      'invalid-private-blob-cleanup-claim',
    );
    expect(records.claimUnboundVerifiedBlobForCleanup).not.toHaveBeenCalled();
  });

  it('does not conceal unexpected database failures or invent a deletion', async () => {
    const { useCase, records } = setup();
    records.claimUnboundVerifiedBlobForCleanup.mockRejectedValueOnce(
      new Error('transaction-failed'),
    );
    await expect(useCase.execute(MEDIA, NOW)).rejects.toThrow(
      'transaction-failed',
    );
  });
});
