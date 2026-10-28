import { AppError } from '@/shared/errors/app-error';
import type { AuthProfilesRepository } from '@/domain/auth/application/repositories/auth-profiles-repository';
import type { ManagedUploadTarget } from '../dtos/managed-upload';
import type { PrivateMediaObjectsRepository } from '../repositories/private-media-objects-repository';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Opaque references only. No storage URLs, paths or tokens. Never infer
 * access from the request JWT role or from the original image uploader.
 * Private bytes still require the separate ReadPrivateBlobImageUseCase.
 */
export class ListActivePrivateBlobReferencesUseCase {
  constructor(
    private readonly profiles: AuthProfilesRepository,
    private readonly records: PrivateMediaObjectsRepository,
  ) {}

  async execute(
    actorId: string,
    target: ManagedUploadTarget,
    resourceIds: readonly string[],
  ): Promise<{
    references: Array<{ resourceId: string; mediaId: string | null }>;
  }> {
    if (
      !UUID.test(actorId) ||
      ![
        'student-photo',
        'teacher-photo',
        'parent-photo',
        'profile-avatar',
      ].includes(target) ||
      resourceIds.length < 1 ||
      resourceIds.length > 25 ||
      resourceIds.some((id) => typeof id !== 'string' || !UUID.test(id)) ||
      new Set(resourceIds).size !== resourceIds.length
    ) {
      throw new AppError(400, 'Invalid private image reference query');
    }

    const current = await this.profiles.findByUserId(actorId);
    if (
      !current ||
      (target === 'profile-avatar'
        ? resourceIds.length !== 1 || resourceIds[0] !== actorId
        : current.role !== 'admin')
    ) {
      // Do not turn an unknown resource or another account into a directory.
      throw new AppError(404, 'Private media unavailable');
    }

    // One DB query for the whole page. The composite FK guarantees that each
    // active binding points at a VERIFIED BLOB record for the same target.
    const active = await this.records.findActiveMediaIds(target, resourceIds);
    const byResource = new Map<string, string>(
      active.map(({ resourceId, mediaId }) => [resourceId, mediaId]),
    );
    return {
      references: resourceIds.map((resourceId) => ({
        resourceId,
        mediaId: byResource.get(resourceId) ?? null,
      })),
    };
  }
}
