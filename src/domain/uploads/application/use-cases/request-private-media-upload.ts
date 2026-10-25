import { randomUUID } from 'node:crypto';
import { AppError } from '@/shared/errors/app-error';
import type { PrivateMediaUploadInput } from '../services/private-media-upload-policy';
import {
  createPrivateMediaObjectKey,
  PRIVATE_PUT_URL_TTL_SECONDS,
  PrivateMediaUploadPolicyError,
} from '../services/private-media-upload-policy';
import {
  PrivateMediaAccessRepository,
  type PrivateMediaActor,
} from '../repositories/private-media-access-repository';
import { PrivateMediaRecordsRepository } from '../repositories/private-media-records-repository';
import { PrivateMediaStorageRepository } from '../repositories/private-media-storage-repository';

const targets = new Set([
  'profile-avatar',
  'student-photo',
  'teacher-photo',
  'parent-photo',
]);

export class RequestPrivateMediaUploadUseCase {
  constructor(
    private readonly access: PrivateMediaAccessRepository,
    private readonly records: PrivateMediaRecordsRepository,
    private readonly storage: PrivateMediaStorageRepository,
  ) {}

  async execute(actor: PrivateMediaActor, input: PrivateMediaUploadInput) {
    if (!targets.has(input.target)) {
      throw new AppError(400, 'Invalid private media target');
    }

    const mediaId = randomUUID();
    let objectKey: string;
    try {
      objectKey = createPrivateMediaObjectKey(actor.id, input, mediaId);
    } catch (error) {
      if (error instanceof PrivateMediaUploadPolicyError) {
        throw new AppError(400, 'Invalid private image upload');
      }
      throw error;
    }

    const resourceId =
      input.target === 'profile-avatar' ? actor.id : input.resourceId!;

    const allowed = await this.access.canAccess({
      actor,
      operation: 'write',
      target: input.target,
      resourceId,
    });
    if (!allowed) {
      // Do not disclose whether a student's record exists to another teacher.
      throw new AppError(404, 'Private media target unavailable');
    }

    const contentType =
      input.contentType.toLowerCase() === 'image/jpg'
        ? 'image/jpeg'
        : input.contentType.toLowerCase();

    // Persist the pending object BEFORE returning any PUT credential.
    // A failed signature leaves a pending row for 02E-16B.4 garbage collection.
    await this.records.createPending({
      id: mediaId,
      requestedById: actor.id,
      target: input.target,
      resourceId,
      objectKey,
      declaredContentType: contentType,
      declaredSizeBytes: input.fileSizeBytes,
      uploadExpiresAt: new Date(
        Date.now() + PRIVATE_PUT_URL_TTL_SECONDS * 1000,
      ),
    });

    const upload = await this.storage.signUpload({
      objectKey,
      contentType,
    });

    return { mediaId, upload };
  }
}
