import type { AppRole } from '@/domain/auth/application/auth.types';
import type { ManagedUploadTarget } from '../dtos/managed-upload';

export interface PrivateMediaActor {
  id: string;
  role: AppRole | null | undefined;
}

export type PrivateMediaOperation = 'read' | 'write';

/**
 * Record-level ACL. The repository MUST check live membership (no teacher
 * cache) for each request. A UUID or a role claim is never enough by itself.
 */
export abstract class PrivateMediaAccessRepository {
  abstract canAccess(input: {
    actor: PrivateMediaActor;
    operation: PrivateMediaOperation;
    target: ManagedUploadTarget;
    resourceId: string;
  }): Promise<boolean>;
}
