import type { AuthSession } from '@/domain/auth/enterprise/entities/auth-session';

export interface CreateAuthSessionRepositoryInput {
  userId: string;
  email: string;
  refreshTokenHash: string;
  expiresAt: Date;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export abstract class AuthSessionsRepository {
  abstract create(
    input: CreateAuthSessionRepositoryInput,
  ): Promise<AuthSession>;
  abstract findActiveById(id: string): Promise<AuthSession | null>;
  /**
   * Atomically consume the old refresh session and persist the replacement.
   * Return null if the old session was already rotated, revoked or expired.
   * The operation MUST lock the old row before creating the successor.
   */
  abstract rotateRefreshSession(
    sessionId: string,
    currentRefreshTokenHash: string,
    replacement: CreateAuthSessionRepositoryInput,
  ): Promise<AuthSession | null>;
  abstract findByRefreshTokenHash(
    refreshTokenHash: string,
  ): Promise<AuthSession | null>;
  abstract findActiveByRefreshTokenHash(
    refreshTokenHash: string,
  ): Promise<AuthSession | null>;
  abstract revoke(
    id: string,
    replacedBySessionId?: string | null,
  ): Promise<void>;
  abstract revokeAllForUser(userId: string): Promise<void>;
}
