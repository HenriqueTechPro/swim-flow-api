import type { PrivateMediaObjectsRepository } from '../repositories/private-media-objects-repository';
import { MIN_PRIVATE_BLOB_RETENTION_DAYS } from './audit-unbound-private-blob-images';

const DAY_MS = 24 * 60 * 60 * 1000;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Internal-only metadata claim. It never uploads, downloads or deletes Blob
 * bytes and is NOT registered as a NestJS controller, job or provider.
 *
 * A claimed row is no longer VERIFIED, so the composite FK blocks a new
 * active binding. The Prisma implementation MUST lock the parent row first.
 */
export class ClaimUnboundPrivateBlobImageUseCase {
  constructor(private readonly records: PrivateMediaObjectsRepository) {}

  async execute(mediaId: string, now: Date = new Date()) {
    if (
      !UUID.test(mediaId) ||
      !(now instanceof Date) ||
      !Number.isFinite(now.getTime())
    ) {
      throw new Error('invalid-private-blob-cleanup-claim');
    }

    const cutoff = new Date(
      now.getTime() - MIN_PRIVATE_BLOB_RETENTION_DAYS * DAY_MS,
    );
    const claimed = await this.records.claimUnboundVerifiedBlobForCleanup(
      mediaId,
      cutoff,
      now,
    );

    return {
      status: claimed ? ('GC_CLAIMED' as const) : ('NOT_ELIGIBLE' as const),
      deletedObjects: 0 as const,
    };
  }
}
