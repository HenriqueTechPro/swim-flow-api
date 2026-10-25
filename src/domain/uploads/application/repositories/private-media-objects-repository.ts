import type { ManagedUploadTarget } from '../dtos/managed-upload';

/**
 * Private PostgreSQL metadata only. Never store a presigned URL, S3 secret,
 * public URL, or browser-supplied object key in this repository.
 */
export interface PendingPrivateMediaObject {
  id: string;
  objectKey: string;
  target: ManagedUploadTarget;
  resourceId: string;
  uploadedById: string;
  declaredContentType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  declaredSizeBytes: number;
  ticketExpiresAt: Date;
}

export type PrivateMediaStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'DELETED';

export interface PrivateMediaObjectRecord extends PendingPrivateMediaObject {
  status: PrivateMediaStatus;
  verifiedAt: Date | null;
}

/**
 * Conditional, atomic updates are the concurrency boundary between
 * verification and cleanup. Each state transition checks the previous state
 * AND the signed PUT expiry in one DB statement.
 */
export abstract class PrivateMediaObjectsRepository {
  abstract createPending(input: PendingPrivateMediaObject): Promise<void>;

  abstract findById(id: string): Promise<PrivateMediaObjectRecord | null>;

  /** PENDING -> VERIFIED only after byte/HEAD verification and expiry. */
  abstract markVerifiedIfPending(
    id: string,
    cutoff: Date,
    verifiedAt: Date,
  ): Promise<boolean>;

  /** PENDING -> REJECTED, never change VERIFIED or DELETED records. */
  abstract rejectIfPending(id: string, cutoff: Date): Promise<boolean>;

  /** Candidates eligible only after the PUT URL's settlement grace. */
  abstract listCleanupCandidates(
    cutoff: Date,
    limit: number,
  ): Promise<PrivateMediaObjectRecord[]>;

  /** REJECTED -> DELETED after confirmed storage deletion. */
  abstract markDeletedIfRejected(id: string): Promise<boolean>;
}
