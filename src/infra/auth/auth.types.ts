import type { AppPermission, AppRole } from '@/domain/auth/application/auth.types';

export type { AppPermission, AppRole };

export interface AuthUser {
  id: string;
  email: string | null;
  sessionId: string;
  role?: AppRole;
  permissions?: AppPermission[];
}
