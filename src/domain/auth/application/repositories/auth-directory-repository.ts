/**
 * Identity-provider port. The application never depends on Supabase SDK types.
 * The current adapter is SupabaseAuthService; replacing it will not require
 * changing ApiAuthService or domain use cases.
 */
export interface AuthIdentity {
  id: string;
  email: string;
  fullName: string | null;
}

export interface AuthDirectoryUser {
  id: string;
  email: string;
  createdAt: Date;
  lastSignInAt: Date | null;
  emailConfirmedAt: Date | null;
}

export interface PasswordResetConfirmation {
  accessToken: string;
  refreshToken: string;
  password: string;
}

export interface DirectoryInvitation {
  email: string;
  redirectTo: string;
  fullName?: string;
}

export abstract class AuthDirectoryRepository {
  abstract signInWithPassword(email: string, password: string): Promise<AuthIdentity>;
  abstract getIdentityFromAccessToken(accessToken: string): Promise<AuthIdentity>;
  abstract sendPasswordResetEmail(email: string, redirectTo: string): Promise<void>;
  abstract confirmPasswordReset(input: PasswordResetConfirmation): Promise<AuthIdentity>;
  abstract inviteUserByEmail(input: DirectoryInvitation): Promise<AuthIdentity>;
  abstract listUsers(): Promise<AuthDirectoryUser[]>;
  abstract deleteUser(userId: string): Promise<void>;
}
