import type { ManagedUploadTarget } from '../dtos/managed-upload';

export abstract class ManagedUploadResourcesRepository {
  abstract existsForTarget(
    target: Exclude<ManagedUploadTarget, 'profile-avatar'>,
    resourceId: string,
  ): Promise<boolean>;
}
