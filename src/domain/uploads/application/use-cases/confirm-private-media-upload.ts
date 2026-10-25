import { AppError } from '@/shared/errors/app-error';
import { AuthProfilesRepository } from '@/domain/auth/application/repositories/auth-profiles-repository';
import { ManagedUploadResourcesRepository } from '../repositories/managed-upload-resources-repository';
import { PrivateMediaObjectsRepository } from '../repositories/private-media-objects-repository';
import { PrivateMediaStorageRepository } from '../repositories/private-media-storage-repository';
import {
  verifyPrivateImageObject,
  PrivateMediaVerificationError,
} from '../services/verify-private-media-upload';
import {
  PRIVATE_MEDIA_SIGNATURE_READ_BYTES,
  settledBefore,
} from '../services/private-media-settlement-policy';
import { canAccessPrivateMediaRecord } from '../services/private-media-record-access';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Internal-only use case. No Nest provider or HTTP controller is wired.
 * Confirm only an upload by the same actor with CURRENT authorized role.
 * Remote errors leave PENDING so they can be retried or cleaned up.
 */
export class ConfirmPrivateMediaUploadUseCase {
  constructor(
    private readonly profiles: AuthProfilesRepository,
    private readonly resources: ManagedUploadResourcesRepository,
    private readonly objects: PrivateMediaObjectsRepository,
    private readonly storage: PrivateMediaStorageRepository,
  ) {}

  async execute(actorId: string, uploadId: string, now = new Date()) {
    if (!UUID.test(actorId) || !UUID.test(uploadId)) {
      throw new AppError(404, 'Private media unavailable');
    }

    const record = await this.objects.findById(uploadId);
    if (
      !record ||
      record.uploadedById !== actorId ||
      !(await canAccessPrivateMediaRecord(
        actorId,
        record,
        this.profiles,
        this.resources,
      ))
    ) {
      throw new AppError(404, 'Private media unavailable');
    }

    if (record.status === 'VERIFIED') {
      return { uploadId, status: 'VERIFIED' as const };
    }
    if (record.status !== 'PENDING') {
      throw new AppError(409, 'Private media is no longer pending');
    }

    const cutoff = settledBefore(now);
    if (record.ticketExpiresAt.getTime() > cutoff.getTime()) {
      throw new AppError(409, 'Signed upload may still be in progress');
    }

    // Storage failure or eventual missing object is NOT proof of invalid bytes.
    // Leave PENDING to support a retry or scheduled cleanup.
    const observed = await this.storage.headObject(record.objectKey);
    if (!observed) {
      throw new AppError(409, 'Private upload object not found');
    }
    const firstBytes = await this.storage.readPrefix(
      record.objectKey,
      PRIVATE_MEDIA_SIGNATURE_READ_BYTES,
    );

    try {
      verifyPrivateImageObject({
        declaredContentType: record.declaredContentType,
        declaredSizeBytes: record.declaredSizeBytes,
        observedContentType: observed.contentType,
        observedSizeBytes: observed.sizeBytes,
        firstBytes,
      });
    } catch (error) {
      if (!(error instanceof PrivateMediaVerificationError)) throw error;
      // Conditional reject prevents a concurrent cleanup or successful
      // verifier from being overwritten by a second request.
      await this.objects.rejectIfPending(uploadId, cutoff);
      throw new AppError(
        422,
        'Private image content does not match declaration',
      );
    }

    if (await this.objects.markVerifiedIfPending(uploadId, cutoff, now)) {
      return { uploadId, status: 'VERIFIED' as const };
    }

    // A concurrent request may already have verified it. Do not misreport
    // success for objects claimed by garbage collection.
    const current = await this.objects.findById(uploadId);
    if (
      current?.status === 'VERIFIED' &&
      current.uploadedById === actorId &&
      (await canAccessPrivateMediaRecord(
        actorId,
        current,
        this.profiles,
        this.resources,
      ))
    ) {
      return { uploadId, status: 'VERIFIED' as const };
    }
    throw new AppError(409, 'Private media state changed during verification');
  }
}
