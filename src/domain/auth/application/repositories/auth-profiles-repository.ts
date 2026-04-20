import type { AppPermission, AppRole } from '../auth.types';
import type { UpdateProfileRequest } from '../dtos/profile-requests';

export interface AuthProfile {
  id: string;
  role: AppRole;
  permissions: AppPermission[];
  fullName: string;
  avatarUrl: string | null;
}

export interface AuthenticatedProfile extends AuthProfile {
  email: string;
}

export abstract class AuthProfilesRepository {
  abstract getOrCreate(input: {
    userId: string;
    email: string;
    fullName?: string | null;
  }): Promise<AuthenticatedProfile>;

  abstract findByUserId(userId: string): Promise<AuthProfile | null>;

  abstract update(
    userId: string,
    input: UpdateProfileRequest,
  ): Promise<AuthProfile>;
}
