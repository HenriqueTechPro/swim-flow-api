import { AppError } from '@/shared/errors/app-error';
import type { AuthProfilesRepository } from '@/domain/auth/application/repositories/auth-profiles-repository';
import type { ManagedUploadResourcesRepository } from '../repositories/managed-upload-resources-repository';
import type { PrivateMediaObjectsRepository } from '../repositories/private-media-objects-repository';
import { canAccessPrivateMediaRecord } from '../services/private-media-record-access';
import { isStrongPrivateMediaEtag } from '../services/private-media-etag-policy';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Internal only. Bind a verified private Blob to its OWN target using
 * compare-and-swap. An old photo is never deleted automatically: a future,
 * audited GC flow must handle retention after the new reference is committed.
 */
export class AssignPrivateBlobImageUseCase {
  constructor(
    private readonly profiles: AuthProfilesRepository,
    private readonly resources: ManagedUploadResourcesRepository,
    private readonly records: PrivateMediaObjectsRepository,
  ) {}

  async execute(
    actorId: string,
    newMediaId: string,
    expectedMediaId: string | null,
  ): Promise<{ mediaId: string; status: 'ACTIVE' }> {
    if (
      !UUID.test(actorId) ||
      !UUID.test(newMediaId) ||
      (expectedMediaId !== null && !UUID.test(expectedMediaId))
    ) {
      throw new AppError(400, 'Invalid private media assignment');
    }

    const record = await this.records.findById(newMediaId);
    if (
      !record ||
      record.storageProvider !== 'BLOB' ||
      record.status !== 'VERIFIED' ||
      record.ticketExpiresAt !== null ||
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

    // The database compares the expected old ID atomically and validates the
    // media target, resource and BLOB/VERIFIED via a composite foreign key.
    const changed = await this.records.assignActiveVerifiedBlob({
      target: record.target,
      resourceId: record.resourceId,
      mediaId: record.id,
      expectedMediaId,
    });
    if (!changed) {
      throw new AppError(409, 'Private media reference changed');
    }

    return { mediaId: record.id, status: 'ACTIVE' };
  }
}
