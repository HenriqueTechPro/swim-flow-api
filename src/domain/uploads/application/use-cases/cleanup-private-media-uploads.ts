import { PrivateMediaObjectsRepository } from '../repositories/private-media-objects-repository';
import { PrivateMediaStorageRepository } from '../repositories/private-media-storage-repository';
import { settledBefore } from '../services/private-media-settlement-policy';

export interface PrivateMediaCleanupSummary {
  inspected: number;
  deleted: number;
  failed: number;
}

/**
 * Internal maintenance use case. Never exposed to an unauthenticated route.
 * Deletion is only attempted on REJECTED rows. Expired PENDING rows first
 * win a conditional PENDING -> REJECTED update, racing safely against confirm.
 */
export class CleanupPrivateMediaUploadsUseCase {
  constructor(
    private readonly objects: PrivateMediaObjectsRepository,
    private readonly storage: PrivateMediaStorageRepository,
  ) {}

  async execute(now = new Date(), limit = 25): Promise<PrivateMediaCleanupSummary> {
    const cutoff = settledBefore(now);
    const candidates = await this.objects.listCleanupCandidates(cutoff, limit);
    let deleted = 0;
    let failed = 0;

    for (const candidate of candidates) {
      if (candidate.status === 'PENDING') {
        const claimed = await this.objects.rejectIfPending(candidate.id, cutoff);
        // If confirmation won first, do not delete its now-VERIFIED bytes.
        if (!claimed) continue;
      } else if (candidate.status !== 'REJECTED') {
        continue;
      }

      try {
        // S3 DELETE is idempotent: a retry handles network/DB failures.
        await this.storage.deleteObject(candidate.objectKey);
        if (await this.objects.markDeletedIfRejected(candidate.id)) {
          deleted++;
        }
      } catch {
        // Keep REJECTED for a future retry; never log the object key or PII.
        failed++;
      }
    }

    return { inspected: candidates.length, deleted, failed };
  }
}
