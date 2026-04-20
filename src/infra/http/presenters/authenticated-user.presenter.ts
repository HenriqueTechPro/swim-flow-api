import type { AuthenticatedUser } from '@/domain/auth/application/dtos/auth-session';
import type { AuthProfile } from '@/domain/auth/application/repositories/auth-profiles-repository';

export class AuthenticatedUserPresenter {
  static toHTTP(profile: AuthProfile, email: string): AuthenticatedUser {
    return {
      id: profile.id,
      email,
      role: profile.role,
      permissions: profile.permissions,
      fullName: profile.fullName,
      avatarUrl: profile.avatarUrl,
    };
  }
}
