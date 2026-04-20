import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type {
  AuthRequestContext,
  AuthSessionResult,
  AuthenticatedUser,
  ConfirmPasswordResetRequest,
  InviteUserRequest,
  LoginRequest,
  RequestPasswordResetRequest,
  AccessTokenLoginRequest,
} from '@/domain/auth/application/dtos/auth-session';
import { AuthProfilesRepository } from '@/domain/auth/application/repositories/auth-profiles-repository';
import { AuthSessionManager } from '@/domain/auth/application/repositories/auth-session-manager';
import { AuthSessionsRepository } from '@/domain/auth/application/repositories/auth-sessions-repository';
import { EnvService } from '@/infra/env/env.service';
import {
  generateRefreshToken,
  hashRefreshToken,
} from './refresh-token.helpers';
import { SupabaseAuthService } from './supabase-auth.service';

@Injectable()
export class ApiAuthService extends AuthSessionManager {
  constructor(
    private readonly authSessionsRepository: AuthSessionsRepository,
    private readonly authProfilesRepository: AuthProfilesRepository,
    private readonly supabaseAuthService: SupabaseAuthService,
    private readonly jwtService: JwtService,
    private readonly envService: EnvService,
  ) {
    super();
  }

  async login(input: LoginRequest): Promise<AuthSessionResult> {
    const identity = await this.supabaseAuthService.signInWithPassword(
      input.email,
      input.password,
    );

    return this.createAuthResultForIdentity(identity, {
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    });
  }

  async loginWithAccessToken(
    input: AccessTokenLoginRequest,
  ): Promise<AuthSessionResult> {
    const identity = await this.supabaseAuthService.getIdentityFromAccessToken(
      input.accessToken,
    );

    return this.createAuthResultForIdentity(identity, {
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    });
  }

  async refresh(
    refreshToken: string,
    context: AuthRequestContext = {},
  ): Promise<AuthSessionResult> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    const refreshTokenHash = hashRefreshToken(refreshToken);
    const currentSession =
      await this.authSessionsRepository.findByRefreshTokenHash(refreshTokenHash);

    if (!currentSession) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    const now = new Date();
    if (currentSession.revokedAt) {
      if (currentSession.replacedBySessionId) {
        await this.authSessionsRepository.revokeAllForUser(currentSession.userId);
      }

      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    if (currentSession.expiresAt <= now) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    const profile = await this.getAuthorizedProfileByIdOrThrow(
      currentSession.userId,
      currentSession.email,
      true,
    );

    const nextRefreshToken = generateRefreshToken();
    const nextSession = await this.authSessionsRepository.create({
      userId: currentSession.userId,
      email: currentSession.email,
      refreshTokenHash: hashRefreshToken(nextRefreshToken),
      expiresAt: this.getRefreshTokenExpiresAt(),
      userAgent: context.userAgent ?? currentSession.userAgent,
      ipAddress: context.ipAddress ?? currentSession.ipAddress,
    });

    await this.authSessionsRepository.revoke(currentSession.id, nextSession.id);

    return this.buildAuthResult(profile, nextSession.id, nextRefreshToken);
  }

  async logout(refreshToken?: string | null) {
    if (!refreshToken) {
      return;
    }

    const session = await this.authSessionsRepository.findActiveByRefreshTokenHash(
      hashRefreshToken(refreshToken),
    );

    if (!session) {
      return;
    }

    await this.authSessionsRepository.revoke(session.id);
  }

  async requestPasswordReset(input: RequestPasswordResetRequest) {
    await this.supabaseAuthService.sendPasswordResetEmail(
      input.email,
      input.redirectTo,
    );
  }

  async confirmPasswordReset(
    input: ConfirmPasswordResetRequest,
  ): Promise<AuthSessionResult> {
    const identity = await this.supabaseAuthService.confirmPasswordReset({
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      password: input.password,
    });

    await this.authSessionsRepository.revokeAllForUser(identity.id);

    const profile = await this.getAuthorizedProfileByIdOrThrow(
      identity.id,
      identity.email,
    );
    const refreshToken = generateRefreshToken();
    const session = await this.authSessionsRepository.create({
      userId: identity.id,
      email: identity.email,
      refreshTokenHash: hashRefreshToken(refreshToken),
      expiresAt: this.getRefreshTokenExpiresAt(),
      userAgent: input.userAgent ?? null,
      ipAddress: input.ipAddress ?? null,
    });

    return this.buildAuthResult(profile, session.id, refreshToken);
  }

  async inviteUser(input: InviteUserRequest) {
    const invitedIdentity = await this.supabaseAuthService.inviteUserByEmail(input);

    await this.authProfilesRepository.getOrCreate({
      userId: invitedIdentity.id,
      email: invitedIdentity.email,
      fullName: invitedIdentity.fullName,
    });
  }

  private async createAuthResultForIdentity(
    identity: {
      id: string;
      email: string;
      fullName: string | null;
    },
    context: AuthRequestContext,
  ) {
    const profile = await this.getAuthorizedProfileByIdOrThrow(
      identity.id,
      identity.email,
    );

    const refreshToken = generateRefreshToken();
    const session = await this.authSessionsRepository.create({
      userId: identity.id,
      email: identity.email,
      refreshTokenHash: hashRefreshToken(refreshToken),
      expiresAt: this.getRefreshTokenExpiresAt(),
      userAgent: context.userAgent ?? null,
      ipAddress: context.ipAddress ?? null,
    });

    return this.buildAuthResult(profile, session.id, refreshToken);
  }

  private async getAuthorizedProfileByIdOrThrow(
    userId: string,
    email: string,
    revokeSessionsOnFailure = false,
  ): Promise<AuthenticatedUser> {
    const profile = await this.authProfilesRepository.findByUserId(userId);

    if (!profile) {
      if (revokeSessionsOnFailure) {
        await this.authSessionsRepository.revokeAllForUser(userId);
      }

      throw new UnauthorizedException('User is not authorized for this application');
    }

    return {
      ...profile,
      email,
    };
  }

  private async buildAuthResult(
    user: AuthenticatedUser,
    sessionId: string,
    refreshToken: string,
  ): Promise<AuthSessionResult> {
    const accessTokenExpiresAt = this.getAccessTokenExpiresAt();
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        sessionId,
      },
      {
        secret: this.envService.jwtAccessSecret,
        expiresIn: `${this.envService.jwtAccessTtlSeconds}s`,
      },
    );

    return {
      accessToken,
      accessTokenExpiresAt: accessTokenExpiresAt.toISOString(),
      refreshToken,
      user,
    };
  }

  private getAccessTokenExpiresAt() {
    return new Date(Date.now() + this.envService.jwtAccessTtlSeconds * 1000);
  }

  private getRefreshTokenExpiresAt() {
    return new Date(
      Date.now() + this.envService.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    );
  }
}
