import { AuthProfilesRepository } from '@/domain/auth/application/repositories/auth-profiles-repository';
import { ManagedUploadResourcesRepository } from '../repositories/managed-upload-resources-repository';
import type { PrivateMediaObjectRecord } from '../repositories/private-media-objects-repository';

/**
 * Reads the CURRENT role, not stale JWT permissions. The image's UUID and
 * original uploader do not grant access. Teacher/student photo ACL stays
 * denied until an explicit class-scoped write/read policy is implemented.
 */
export async function canAccessPrivateMediaRecord(
  actorId: string,
  record: PrivateMediaObjectRecord,
  profiles: AuthProfilesRepository,
  resources: ManagedUploadResourcesRepository,
): Promise<boolean> {
  const profile = await profiles.findByUserId(actorId);
  if (!profile) return false;

  if (record.target === 'profile-avatar') {
    return record.resourceId === actorId;
  }

  if (profile.role !== 'admin') return false;
  return resources.existsForTarget(record.target, record.resourceId);
}
