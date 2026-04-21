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

export interface AuthAccessProfile extends AuthProfile {
  email: string;
  createdAt: Date;
  lastSignInAt: Date | null;
  emailConfirmedAt: Date | null;
}

export abstract class AuthProfilesRepository {
  abstract getOrCreate(input: {
    userId: string;
    email: string;
    fullName?: string | null;
    role?: AppRole;
  }): Promise<AuthenticatedProfile>;

  abstract findByUserId(userId: string): Promise<AuthProfile | null>;

  abstract list(): Promise<AuthProfile[]>;

  abstract countByRole(role: AppRole): Promise<number>;

  abstract updateRole(userId: string, role: AppRole): Promise<AuthProfile>;

  abstract deleteByUserId(userId: string): Promise<void>;

  abstract update(
    userId: string,
    input: UpdateProfileRequest,
  ): Promise<AuthProfile>;
}
