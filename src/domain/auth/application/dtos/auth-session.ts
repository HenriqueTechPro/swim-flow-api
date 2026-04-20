import type { AppPermission, AppRole } from '../auth.types';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: AppRole;
  permissions: AppPermission[];
  fullName: string;
  avatarUrl: string | null;
}

export interface AuthSessionResult {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  user: AuthenticatedUser;
}

export interface AuthRequestContext {
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface LoginRequest extends AuthRequestContext {
  email: string;
  password: string;
}

export interface AccessTokenLoginRequest extends AuthRequestContext {
  accessToken: string;
}

export interface RequestPasswordResetRequest {
  email: string;
  redirectTo: string;
}

export interface ConfirmPasswordResetRequest extends AuthRequestContext {
  accessToken: string;
  refreshToken: string;
  password: string;
}

export interface InviteUserRequest {
  email: string;
  redirectTo: string;
  fullName?: string;
}
