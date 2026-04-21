import type { AuthAccessProfile } from '@/domain/auth/application/repositories/auth-profiles-repository';

export class AccessProfilePresenter {
  static toHTTP(profile: AuthAccessProfile) {
    return {
      id: profile.id,
      email: profile.email,
      full_name: profile.fullName,
      avatar_url: profile.avatarUrl,
      role: profile.role,
      permissions: profile.permissions,
      created_at: profile.createdAt.toISOString(),
      last_sign_in_at: profile.lastSignInAt?.toISOString() ?? null,
      email_confirmed_at: profile.emailConfirmedAt?.toISOString() ?? null,
      access_state: profile.lastSignInAt ? 'active' : 'invited',
    };
  }
}
