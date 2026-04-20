import type { AuthProfile } from '@/domain/auth/application/repositories/auth-profiles-repository';

export class ProfilePresenter {
  static toHTTP(profile: AuthProfile) {
    return {
      id: profile.id,
      full_name: profile.fullName,
      avatar_url: profile.avatarUrl,
      role: profile.role,
    };
  }
}
