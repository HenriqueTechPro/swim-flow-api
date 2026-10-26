import type { PrivateMediaObjectsRepository } from '../repositories/private-media-objects-repository';

export const MIN_PRIVATE_BLOB_RETENTION_DAYS = 30;
export const PRIVATE_BLOB_AUDIT_BATCH_SIZE = 25;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Non-destructive internal audit. A candidate is NEVER proof that the object
 * is safe to delete: another transaction might bind it immediately after
 * the SELECT. A future cleanup needs an atomic DB claim before remote I/O.
 *
 * No Blob adapter, tokens, URLs, object paths, DELETE or Nest HTTP route.
 */
export class AuditUnboundPrivateBlobImagesUseCase {
  constructor(private readonly records: PrivateMediaObjectsRepository) {}

  async execute(now = new Date()) {
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
      throw new Error('invalid-private-blob-audit-date');
    }

    const retentionCutoff = new Date(
      now.getTime() - MIN_PRIVATE_BLOB_RETENTION_DAYS * DAY_MS,
    );

    // Fetch one extra row to report whether the page is incomplete. This is
    // an estimate/snapshot, NOT a full inventory and NOT a delete command.
    const rows = await this.records.listUnboundVerifiedBlobCandidates(
      retentionCutoff,
      PRIVATE_BLOB_AUDIT_BATCH_SIZE + 1,
    );

    const selected = rows.slice(0, PRIVATE_BLOB_AUDIT_BATCH_SIZE);
    let estimatedBytes = 0;
    const byTarget: Record<string, number> = {};

    for (const entry of selected) {
      if (
        !Number.isSafeInteger(entry.declaredSizeBytes) ||
        entry.declaredSizeBytes <= 0 ||
        !Number.isFinite(entry.verifiedAt?.getTime()) ||
        entry.verifiedAt.getTime() > retentionCutoff.getTime()
      ) {
        throw new Error('invalid-private-blob-audit-record');
      }
      estimatedBytes += entry.declaredSizeBytes;
      byTarget[entry.target] = (byTarget[entry.target] ?? 0) + 1;
    }

    return {
      mode: 'DRY_RUN' as const,
      retentionDays: MIN_PRIVATE_BLOB_RETENTION_DAYS,
      cutoff: retentionCutoff.toISOString(),
      sampledCandidates: selected.length,
      hasMoreCandidates: rows.length > PRIVATE_BLOB_AUDIT_BATCH_SIZE,
      estimatedBytesInSample: estimatedBytes,
      byTarget,
      deletedObjects: 0 as const,
    };
  }
}
