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

export abstract class PrivateMediaObjectsRepository {
  abstract createPending(input: PendingPrivateMediaObject): Promise<void>;
}
