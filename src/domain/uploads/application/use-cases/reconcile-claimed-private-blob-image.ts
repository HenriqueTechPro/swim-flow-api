import type { PrivateBlobStorageRepository } from '../repositories/private-blob-storage-repository';
import type { PrivateMediaObjectsRepository } from '../repositories/private-media-objects-repository';
import { isStrongPrivateMediaEtag } from '../services/private-media-etag-policy';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Internal-only reconciliation, not an HTTP endpoint or scheduled GC.
 *
 * A retry after interrupted remote DELETE is safe: when HEAD says 404, the
 * same claimed record can be finalized without repeating the deletion.
 * Unknown transport errors NEVER count as evidence of absent bytes.
 */
export class ReconcileClaimedPrivateBlobImageUseCase {
  constructor(
    private readonly records: PrivateMediaObjectsRepository,
    private readonly blobs: PrivateBlobStorageRepository,
  ) {}

  async execute(mediaId: string, now = new Date()) {
    if (
      !UUID.test(mediaId) ||
      !(now instanceof Date) ||
      !Number.isFinite(now.getTime())
    ) {
      throw new Error('invalid-private-blob-cleanup-reconciliation');
    }
    const record = await this.records.findById(mediaId);
    if (
      !record ||
      record.storageProvider !== 'BLOB' ||
      !isStrongPrivateMediaEtag(record.verifiedEtag)
    ) {
      return { status: 'NOT_ELIGIBLE' as const };
    }
    if (record.status === 'DELETED') {
      if (!record.cleanupCompletedAt) {
        throw new Error('invalid-private-blob-cleanup-state');
      }
      return { status: 'ALREADY_COMPLETED' as const };
    }
    if (
      record.status !== 'GC_CLAIMED' ||
      !record.cleanupClaimedAt ||
      record.cleanupCompletedAt !== null ||
      record.cleanupClaimedAt.getTime() > now.getTime()
    ) {
      return { status: 'NOT_ELIGIBLE' as const };
    }

    const pathname = record.objectKey;
    const etag = record.verifiedEtag;
    const before = await this.blobs.stat(pathname);
    if (before && before.etag !== etag) {
      throw new Error('private-blob-cleanup-etag-conflict');
    }
    if (before) {
      // Conditional deletion never deletes a different generation. If this
      // request times out, GC_CLAIMED persists and the retry will HEAD.
      await this.blobs.delete(pathname, etag);
    }
    const after = await this.blobs.stat(pathname);
    if (after !== null) {
      throw new Error('private-blob-cleanup-not-confirmed');
    }

    const updated = await this.records.completeClaimedBlobCleanup(
      record.id,
      etag,
      record.cleanupClaimedAt,
      now,
    );
    if (!updated) {
      // A racing reconcilier may have already completed the same claim.
      const current = await this.records.findById(mediaId);
      if (
        current?.storageProvider === 'BLOB' &&
        current.status === 'DELETED' &&
        current.verifiedEtag === etag &&
        current.cleanupClaimedAt?.getTime() === record.cleanupClaimedAt.getTime() &&
        current.cleanupCompletedAt
      ) {
        return { status: 'ALREADY_COMPLETED' as const };
      }
      throw new Error('private-blob-cleanup-finalization-race');
    }
    return { status: 'COMPLETED' as const };
  }
}
