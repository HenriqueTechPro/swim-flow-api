import { AppError } from '@/shared/errors/app-error';
import type { AuthProfilesRepository } from '@/domain/auth/application/repositories/auth-profiles-repository';
import type { ManagedUploadResourcesRepository } from '../repositories/managed-upload-resources-repository';
import type {
  CommitPrivateBlobBindingInput,
  PrivateMediaObjectsRepository,
} from '../repositories/private-media-objects-repository';
import { isStrongPrivateMediaEtag } from '../services/private-media-etag-policy';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const targets = [
  'student-photo',
  'teacher-photo',
  'parent-photo',
  'profile-avatar',
] as const;

/**
 * Safe handoff from URL-backed legacy photos to private media bindings.
 * A new candidate MUST be independently VERIFIED. The repository performs
 * legacy URL CAS + private binding CAS atomically in PostgreSQL.
 */
export class CommitPrivateBlobImageUseCase {
  constructor(
    private readonly profiles: AuthProfilesRepository,
    private readonly resources: ManagedUploadResourcesRepository,
    private readonly records: PrivateMediaObjectsRepository,
  ) {}

  async execute(actorId: string, input: CommitPrivateBlobBindingInput) {
    if (
      !UUID.test(actorId) ||
      !targets.includes(input.target) ||
      !UUID.test(input.resourceId) ||
      (input.newMediaId !== null && !UUID.test(input.newMediaId)) ||
      (input.expectedMediaId !== null && !UUID.test(input.expectedMediaId)) ||
      (input.newMediaId === null && input.expectedMediaId === null) ||
      (input.newMediaId !== null && input.newMediaId === input.expectedMediaId) ||
      (input.expectedLegacyUrl !== null &&
        (typeof input.expectedLegacyUrl !== 'string' ||
          input.expectedLegacyUrl.length > 2048))
    ) {
      throw new AppError(400, 'Invalid private image commit');
    }

    const actor = await this.profiles.findByUserId(actorId);
    const authorized = actor && (input.target === 'profile-avatar'
      ? input.resourceId === actorId
      : actor.role === 'admin' &&
        (await this.resources.existsForTarget(input.target, input.resourceId)));
    if (!authorized) {
      throw new AppError(404, 'Private media unavailable');
    }

    if (input.newMediaId !== null) {
      const next = await this.records.findById(input.newMediaId);
      if (
        !next ||
        next.target !== input.target ||
        next.resourceId !== input.resourceId ||
        next.storageProvider !== 'BLOB' ||
        next.status !== 'VERIFIED' ||
        next.ticketExpiresAt !== null ||
        !isStrongPrivateMediaEtag(next.verifiedEtag)
      ) {
        throw new AppError(404, 'Private media unavailable');
      }
    }

    const changed = await this.records.commitPrivateBlobBinding(input);
    if (!changed) {
      throw new AppError(409, 'Private image or legacy photo changed');
    }

    return {
      mediaId: input.newMediaId,
      status: input.newMediaId === null ? 'REMOVED' as const : 'ACTIVE' as const,
    };
  }
}
