import type { ManagedUploadTarget } from '../dtos/managed-upload';

export type PrivateMediaRecordStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'DELETED';

export interface PrivateMediaRecord {
  id: string;
  requestedById: string;
  target: ManagedUploadTarget;
  resourceId: string;
  objectKey: string;
  status: PrivateMediaRecordStatus;
}

export interface CreatePendingPrivateMediaRecord {
  id: string;
  requestedById: string;
  target: ManagedUploadTarget;
  resourceId: string;
  objectKey: string;
  declaredContentType: string;
  declaredSizeBytes: number;
  uploadExpiresAt: Date;
}

/**
 * Metadata only: stores no public URLs and no short-lived signed tokens.
 * Confirmation and garbage collection are deliberately deferred to 02E-16B.4.
 */
export abstract class PrivateMediaRecordsRepository {
  abstract createPending(
    record: CreatePendingPrivateMediaRecord,
  ): Promise<PrivateMediaRecord>;

  abstract findById(id: string): Promise<PrivateMediaRecord | null>;
}
