import type {
  AccessTokenLoginRequest,
  AuthRequestContext,
  AuthSessionResult,
  ConfirmPasswordResetRequest,
  InviteUserRequest,
  LoginRequest,
  RequestPasswordResetRequest,
} from '../dtos/auth-session';

export abstract class AuthSessionManager {
  abstract login(input: LoginRequest): Promise<AuthSessionResult>;
  abstract loginWithAccessToken(
    input: AccessTokenLoginRequest,
  ): Promise<AuthSessionResult>;
  abstract refresh(
    refreshToken: string,
    context?: AuthRequestContext,
  ): Promise<AuthSessionResult>;
  abstract logout(refreshToken?: string | null): Promise<void>;
  abstract requestPasswordReset(
    input: RequestPasswordResetRequest,
  ): Promise<void>;
  abstract confirmPasswordReset(
    input: ConfirmPasswordResetRequest,
  ): Promise<AuthSessionResult>;
  abstract inviteUser(input: InviteUserRequest): Promise<void>;
}
