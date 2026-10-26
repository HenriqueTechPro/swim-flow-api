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

/** Server-processed Vercel Blob media, verified before DB insertion. */
export interface VerifiedPrivateBlobMediaObject {
  id: string;
  objectKey: string;
  target: ManagedUploadTarget;
  resourceId: string;
  uploadedById: string;
  declaredContentType: 'image/jpeg';
  declaredSizeBytes: number;
  verifiedAt: Date;
  verifiedEtag: string;
}

export type PrivateMediaStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'REJECTED'
  | 'DELETED';

export interface PrivateMediaObjectRecord extends Omit<
  PendingPrivateMediaObject,
  'ticketExpiresAt'
> {
  storageProvider: 'R2' | 'BLOB';
  ticketExpiresAt: Date | null;
  status: PrivateMediaStatus;
  verifiedAt: Date | null;
  verifiedEtag: string | null;
}

/**
 * Conditional, atomic updates are the concurrency boundary between
 * verification and cleanup. Each state transition checks the previous state
 * AND the signed PUT expiry in one DB statement.
 */
export abstract class PrivateMediaObjectsRepository {
  abstract createPending(input: PendingPrivateMediaObject): Promise<void>;

  /** Insert a server-processed Blob image directly as VERIFIED, atomically. */
  abstract createVerifiedBlob(
    input: VerifiedPrivateBlobMediaObject,
  ): Promise<void>;

  abstract findById(id: string): Promise<PrivateMediaObjectRecord | null>;

  /** Current binding only; never infer an active image from a UUID alone. */
  abstract findActiveMediaId(
    target: ManagedUploadTarget,
    resourceId: string,
  ): Promise<string | null>;

  /**
   * Optimistic reference swap. When expectedMediaId is null, attach only if no
   * current image exists; otherwise replace only that exact old media ID.
   * Database FK enforces same target/resource + BLOB/VERIFIED status.
   */
  abstract assignActiveVerifiedBlob(input: {
    target: ManagedUploadTarget;
    resourceId: string;
    mediaId: string;
    expectedMediaId: string | null;
  }): Promise<boolean>;

  /** PENDING -> VERIFIED only after byte/HEAD verification and expiry. */
  abstract markVerifiedIfPending(
    id: string,
    cutoff: Date,
    verifiedAt: Date,
    verifiedEtag: string,
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
