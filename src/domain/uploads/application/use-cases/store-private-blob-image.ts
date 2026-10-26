import { randomUUID } from 'node:crypto';
import { AppError } from '@/shared/errors/app-error';
import type { AuthProfilesRepository } from '@/domain/auth/application/repositories/auth-profiles-repository';
import type { ManagedUploadTarget } from '../dtos/managed-upload';
import type { ManagedUploadResourcesRepository } from '../repositories/managed-upload-resources-repository';
import type { PrivateBlobStorageRepository } from '../repositories/private-blob-storage-repository';
import type { PrivateBlobImageProcessor } from '../repositories/private-blob-image-processor';
import type { PrivateMediaObjectsRepository } from '../repositories/private-media-objects-repository';
import {
  MAX_PRIVATE_IMAGE_BYTES,
  validatePrivateMediaUpload,
  PrivateMediaUploadPolicyError,
} from '../services/private-media-upload-policy';
import { isStrongPrivateMediaEtag } from '../services/private-media-etag-policy';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface StorePrivateBlobImageInput {
  target: ManagedUploadTarget;
  resourceId?: string;
  contentType: string;
  bytes: Uint8Array;
}

/**
 * Internal application flow only. Every actor is checked against the CURRENT
 * database role before decode/upload AND before durable metadata insertion.
 * No Nest HTTP controller/providers yet: input bytes are from a future
 * server-owned authenticated handler, NOT a browser-supplied Blob pathname.
 */
export class StorePrivateBlobImageUseCase {
  constructor(
    private readonly profiles: AuthProfilesRepository,
    private readonly resources: ManagedUploadResourcesRepository,
    private readonly images: PrivateBlobImageProcessor,
    private readonly blobs: PrivateBlobStorageRepository,
    private readonly records: PrivateMediaObjectsRepository,
  ) {}

  private async authorize(
    actorId: string,
    target: ManagedUploadTarget,
    resourceId: string,
  ): Promise<boolean> {
    const profile = await this.profiles.findByUserId(actorId);
    if (!profile) return false;
    if (target === 'profile-avatar') return resourceId === actorId;
    return (
      profile.role === 'admin' &&
      (await this.resources.existsForTarget(target, resourceId))
    );
  }

  async execute(actorId: string, input: StorePrivateBlobImageInput) {
    if (!UUID.test(actorId) || !(input.bytes instanceof Uint8Array)) {
      throw new AppError(400, 'Invalid private image upload');
    }
    const size = input.bytes.byteLength;
    if (size < 8 || size > MAX_PRIVATE_IMAGE_BYTES) {
      throw new AppError(400, 'Invalid private image upload');
    }
    try {
      validatePrivateMediaUpload(actorId, {
        target: input.target,
        resourceId: input.target === 'profile-avatar' ? undefined : input.resourceId,
        fileName: 'image',
        contentType: input.contentType,
        fileSizeBytes: size,
      });
    } catch (error) {
      if (error instanceof PrivateMediaUploadPolicyError) {
        throw new AppError(400, 'Invalid private image upload');
      }
      throw error;
    }
    const resourceId = input.target === 'profile-avatar'
      ? actorId
      : input.resourceId!;
    if (!(await this.authorize(actorId, input.target, resourceId))) {
      throw new AppError(404, 'Private media unavailable');
    }

    // Always normalize before writing. The original file (and its EXIF)
    // must never be persisted, even temporarily.
    const image = await this.images.normalize(input.bytes, input.contentType);
    if (
      image.contentType !== 'image/jpeg' ||
      image.bytes.byteLength < 8 ||
      image.bytes.byteLength > MAX_PRIVATE_IMAGE_BYTES
    ) {
      throw new Error('invalid-normalized-private-image');
    }

    const uploadId = randomUUID();
    const folder: Record<ManagedUploadTarget, string> = {
      'profile-avatar': 'profiles',
      'student-photo': 'students',
      'teacher-photo': 'teachers',
      'parent-photo': 'parents',
    };
    const pathname = `private/${folder[input.target]}/${resourceId}/${uploadId}.jpg`;

    // Check role again: an administrator can lose access while the image is
    // being decoded. A revoked actor must not initiate a storage write.
    if (!(await this.authorize(actorId, input.target, resourceId))) {
      throw new AppError(404, 'Private media unavailable');
    }

    const stored = await this.blobs.put({
      pathname,
      bytes: image.bytes,
      contentType: image.contentType,
    });
    if (
      stored.pathname !== pathname ||
      stored.contentType !== image.contentType ||
      stored.sizeBytes !== image.bytes.byteLength ||
      !isStrongPrivateMediaEtag(stored.etag)
    ) {
      throw new Error('invalid-private-blob-storage-receipt');
    }

    try {
      // Read current privileges AGAIN before making the object discoverable.
      if (!(await this.authorize(actorId, input.target, resourceId))) {
        throw new AppError(404, 'Private media unavailable');
      }
      await this.records.createVerifiedBlob({
        id: uploadId,
        objectKey: pathname,
        target: input.target,
        resourceId,
        uploadedById: actorId,
        declaredContentType: 'image/jpeg',
        declaredSizeBytes: stored.sizeBytes,
        verifiedAt: new Date(),
        verifiedEtag: stored.etag,
      });
    } catch (error) {
      try {
        // Compensate ONLY the exact generation we created. If network
        // fails, leave an orphan for future, separately designed recovery.
        await this.blobs.delete(pathname, stored.etag);
      } catch {
        // Never log the pathname or photograph's personal details.
        throw new Error('private-blob-compensation-failed');
      }
      throw error;
    }
    return { uploadId, status: 'VERIFIED' as const };
  }
}
