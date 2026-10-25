import { randomUUID } from 'node:crypto';
import { AppError } from '@/shared/errors/app-error';
import { AuthProfilesRepository } from '@/domain/auth/application/repositories/auth-profiles-repository';
import type { ManagedUploadTarget } from '../dtos/managed-upload';
import { ManagedUploadResourcesRepository } from '../repositories/managed-upload-resources-repository';
import { PrivateMediaObjectsRepository } from '../repositories/private-media-objects-repository';
import { PrivateMediaStorageRepository } from '../repositories/private-media-storage-repository';
import {
  createPrivateMediaObjectKey,
  validatePrivateMediaUpload,
  PrivateMediaUploadPolicyError,
  type PrivateMediaUploadInput,
} from '../services/private-media-upload-policy';

type MediaScope = {
  actorId: string;
  target: ManagedUploadTarget;
  resourceId: string;
};

function canonicalContentType(value: string) {
  return value.toLowerCase() === 'image/jpg'
    ? ('image/jpeg' as const)
    : (value.toLowerCase() as
        | 'image/jpeg'
        | 'image/png'
        | 'image/webp'
        | 'image/gif');
}

/**
 * Prepares a PRIVATE upload only. This use case is intentionally not exposed
 * via HTTP while confirmation, safe private reads and stale-object cleanup
 * remain incomplete. A valid key/UUID is NOT itself an authorization grant.
 */
export class PreparePrivateMediaUploadUseCase {
  constructor(
    private readonly profiles: AuthProfilesRepository,
    private readonly resources: ManagedUploadResourcesRepository,
    private readonly storage: PrivateMediaStorageRepository,
    private readonly objects: PrivateMediaObjectsRepository,
  ) {}

  async execute(actorId: string, input: PrivateMediaUploadInput) {
    try {
      validatePrivateMediaUpload(actorId, input);
    } catch (error) {
      if (error instanceof PrivateMediaUploadPolicyError) {
        throw new AppError(400, 'Invalid private image upload request');
      }
      throw error;
    }

    const { resourceId } = await this.authorizeScope(actorId, input);

    const uploadId = randomUUID();
    const objectKey = createPrivateMediaObjectKey(actorId, input, uploadId);
    const contentType = canonicalContentType(input.contentType);

    // If signing fails, do not write a pending DB record. If the DB write
    // fails, the signed URL is never returned to the caller.
    const ticket = await this.storage.signUpload({ objectKey, contentType });
    if (
      ticket.method !== 'PUT' ||
      !Number.isSafeInteger(ticket.expiresInSeconds) ||
      ticket.expiresInSeconds <= 0 ||
      ticket.expiresInSeconds > 90 ||
      !ticket.url.startsWith('https://') ||
      ticket.headers['Content-Type'] !== contentType
    ) {
      throw new Error('Invalid private upload ticket returned by storage');
    }
    await this.objects.createPending({
      id: uploadId,
      objectKey,
      target: input.target,
      resourceId,
      uploadedById: actorId,
      declaredContentType: contentType,
      declaredSizeBytes: input.fileSizeBytes,
      ticketExpiresAt: new Date(Date.now() + ticket.expiresInSeconds * 1000),
    });
    // Only the signed PUT URL is returned; no public image URL exists.
    return {
      uploadId,
      method: ticket.method,
      uploadUrl: ticket.url,
      headers: ticket.headers,
      expiresInSeconds: ticket.expiresInSeconds,
    };
  }

  private async authorizeScope(
    actorId: string,
    input: PrivateMediaUploadInput,
  ): Promise<MediaScope> {
    // Always load the CURRENT role from the database, never from a JWT role
    // claim, a caller-supplied role, or the target's UUID.
    const profile = await this.profiles.findByUserId(actorId);
    if (!profile) {
      throw new AppError(403, 'Authenticated profile is not active');
    }
    if (input.target === 'profile-avatar') {
      return { actorId, target: input.target, resourceId: actorId };
    }

    // Teacher/class-scoped photos cannot be authorized solely by record
    // existence. Until record-level grants are implemented, only admins
    // may upload them; this fails closed for children and guardians.
    if (profile.role !== 'admin') {
      throw new AppError(403, 'Private resource upload is restricted');
    }
    const resourceId = input.resourceId!;
    if (!(await this.resources.existsForTarget(input.target, resourceId))) {
      throw new AppError(404, 'Upload target resource not found');
    }
    return { actorId, target: input.target, resourceId };
  }
}
