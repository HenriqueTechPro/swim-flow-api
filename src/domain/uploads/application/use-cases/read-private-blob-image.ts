import { AppError } from '@/shared/errors/app-error';
import type { AuthProfilesRepository } from '@/domain/auth/application/repositories/auth-profiles-repository';
import type { ManagedUploadResourcesRepository } from '../repositories/managed-upload-resources-repository';
import type { PrivateBlobStorageRepository } from '../repositories/private-blob-storage-repository';
import type { PrivateMediaObjectsRepository } from '../repositories/private-media-objects-repository';
import { canAccessPrivateMediaRecord } from '../services/private-media-record-access';
import { isStrongPrivateMediaEtag } from '../services/private-media-etag-policy';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Internal-only. Never return a Blob URL or server token. A controller must
 * stream after authentication and set Cache-Control: private, no-store.
 */
export class ReadPrivateBlobImageUseCase {
  constructor(
    private readonly profiles: AuthProfilesRepository,
    private readonly resources: ManagedUploadResourcesRepository,
    private readonly records: PrivateMediaObjectsRepository,
    private readonly blobs: PrivateBlobStorageRepository,
  ) {}

  async execute(actorId: string, uploadId: string) {
    if (!UUID.test(actorId) || !UUID.test(uploadId)) {
      throw new AppError(404, 'Private media unavailable');
    }
    const record = await this.records.findById(uploadId);
    if (
      !record ||
      record.status !== 'VERIFIED' ||
      !isStrongPrivateMediaEtag(record.verifiedEtag) ||
      !(await canAccessPrivateMediaRecord(
        actorId,
        record,
        this.profiles,
        this.resources,
      ))
    ) {
      throw new AppError(404, 'Private media unavailable');
    }

    const blob = await this.blobs.get(record.objectKey, record.verifiedEtag);
    if (
      !blob ||
      blob.pathname !== record.objectKey ||
      blob.etag !== record.verifiedEtag ||
      blob.sizeBytes !== record.declaredSizeBytes ||
      blob.contentType !== record.declaredContentType
    ) {
      throw new AppError(404, 'Private media unavailable');
    }
    return {
      stream: blob.stream,
      headers: {
        'Content-Type': blob.contentType,
        'Content-Length': String(blob.sizeBytes),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    };
  }
}
