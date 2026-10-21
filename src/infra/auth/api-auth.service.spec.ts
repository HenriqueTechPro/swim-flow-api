import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthProfilesRepository } from '@/domain/auth/application/repositories/auth-profiles-repository';
import { AuthSessionsRepository } from '@/domain/auth/application/repositories/auth-sessions-repository';
import { EnvService } from '@/infra/env/env.service';
import { hashRefreshToken } from './refresh-token.helpers';
import { ApiAuthService } from './api-auth.service';
import { AuthDirectoryRepository } from '@/domain/auth/application/repositories/auth-directory-repository';

describe('ApiAuthService', () => {
  let authSessionsRepository: jest.Mocked<AuthSessionsRepository>;
  let authProfilesRepository: jest.Mocked<AuthProfilesRepository>;
  let authDirectory: jest.Mocked<AuthDirectoryRepository>;
  let jwtService: jest.Mocked<JwtService>;
  let envService: EnvService;
  let sut: ApiAuthService;

  beforeEach(() => {
    authSessionsRepository = {
      create: jest.fn(),
      findActiveById: jest.fn(),
      findByRefreshTokenHash: jest.fn(),
      findActiveByRefreshTokenHash: jest.fn(),
      revoke: jest.fn(),
      revokeAllForUser: jest.fn(),
    } as jest.Mocked<AuthSessionsRepository>;

    authProfilesRepository = {
      findByUserId: jest.fn(),
      getOrCreate: jest.fn(),
      list: jest.fn(),
      countByRole: jest.fn(),
      updateRole: jest.fn(),
      update: jest.fn(),
    } as jest.Mocked<AuthProfilesRepository>;

    authDirectory = {
      signInWithPassword: jest.fn(),
      getIdentityFromAccessToken: jest.fn(),
      sendPasswordResetEmail: jest.fn(),
      confirmPasswordReset: jest.fn(),
      inviteUserByEmail: jest.fn(),
      listUsers: jest.fn(),
      deleteUser: jest.fn(),
    } as jest.Mocked<AuthDirectoryRepository>;

    jwtService = {
      signAsync: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    envService = {
      jwtAccessSecret: 'development-jwt-access-secret-change-me',
      jwtAccessTtlSeconds: 900,
      refreshTokenTtlDays: 7,
    } as EnvService;

    sut = new ApiAuthService(
      authSessionsRepository,
      authProfilesRepository,
      authDirectory,
      jwtService,
      envService,
    );
  });

  it('rotates an active refresh token and issues a new access token', async () => {
    const refreshToken = 'refresh-token';

    authSessionsRepository.findByRefreshTokenHash.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      email: 'user@example.com',
      refreshTokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      replacedBySessionId: null,
      userAgent: 'old-agent',
      ipAddress: '127.0.0.1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    authProfilesRepository.findByUserId.mockResolvedValue({
      id: 'user-1',
      role: 'admin',
      permissions: ['auth:invite'],
      fullName: 'User Example',
      avatarUrl: null,
    });
    authSessionsRepository.create.mockResolvedValue({
      id: 'session-2',
      userId: 'user-1',
      email: 'user@example.com',
      refreshTokenHash: 'next-hash',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      replacedBySessionId: null,
      userAgent: 'new-agent',
      ipAddress: '10.0.0.1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    jwtService.signAsync.mockResolvedValue('signed-access-token');

    const result = await sut.refresh(refreshToken, {
      userAgent: 'new-agent',
      ipAddress: '10.0.0.1',
    });

    expect(authSessionsRepository.revoke).toHaveBeenCalledWith(
      'session-1',
      'session-2',
    );
    expect(authSessionsRepository.revokeAllForUser).not.toHaveBeenCalled();
    expect(result.accessToken).toBe('signed-access-token');
    expect(result.user).toEqual({
      id: 'user-1',
      email: 'user@example.com',
      role: 'admin',
      permissions: ['auth:invite'],
      fullName: 'User Example',
      avatarUrl: null,
    });
  });

  it('revokes the session family when a rotated refresh token is replayed', async () => {
    const refreshToken = 'stolen-refresh-token';

    authSessionsRepository.findByRefreshTokenHash.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      email: 'user@example.com',
      refreshTokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
      replacedBySessionId: 'session-2',
      userAgent: 'old-agent',
      ipAddress: '127.0.0.1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(sut.refresh(refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(authSessionsRepository.revokeAllForUser).toHaveBeenCalledWith(
      'user-1',
    );
    expect(authProfilesRepository.findByUserId).not.toHaveBeenCalled();
    expect(authSessionsRepository.create).not.toHaveBeenCalled();
  });

  it('rejects refresh when the session owner is no longer authorized', async () => {
    const refreshToken = 'refresh-token';

    authSessionsRepository.findByRefreshTokenHash.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      email: 'user@example.com',
      refreshTokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      replacedBySessionId: null,
      userAgent: 'old-agent',
      ipAddress: '127.0.0.1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    authProfilesRepository.findByUserId.mockResolvedValue(null);

    await expect(sut.refresh(refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(authSessionsRepository.revokeAllForUser).toHaveBeenCalledWith('user-1');
    expect(authSessionsRepository.create).not.toHaveBeenCalled();
  });

  it('delegates password recovery to the identity provider port', async () => {
    authDirectory.sendPasswordResetEmail.mockResolvedValue();

    await sut.requestPasswordReset({
      email: 'swimmer@example.invalid',
      redirectTo: 'https://app.example.invalid/reset-password',
    });

    expect(authDirectory.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    expect(authDirectory.sendPasswordResetEmail).toHaveBeenCalledWith(
      'swimmer@example.invalid',
      'https://app.example.invalid/reset-password',
    );
  });

  it('stores the invited role when provisioning an invited user', async () => {
    authDirectory.inviteUserByEmail.mockResolvedValue({
      id: 'user-2',
      email: 'invitee@example.com',
      fullName: 'Invitee User',
    });
    authProfilesRepository.getOrCreate.mockResolvedValue({
      id: 'user-2',
      email: 'invitee@example.com',
      role: 'teacher',
      permissions: ['teachers:read', 'teachers:write'],
      fullName: 'Invitee User',
      avatarUrl: null,
    });

    await sut.inviteUser({
      email: 'invitee@example.com',
      fullName: 'Invitee User',
      redirectTo: 'http://localhost:8080/reset-password',
      role: 'teacher',
    });

    expect(authDirectory.inviteUserByEmail).toHaveBeenCalledWith({
      email: 'invitee@example.com',
      fullName: 'Invitee User',
      redirectTo: 'http://localhost:8080/reset-password',
      role: 'teacher',
    });
    expect(authProfilesRepository.getOrCreate).toHaveBeenCalledWith({
      userId: 'user-2',
      email: 'invitee@example.com',
      fullName: 'Invitee User',
      role: 'teacher',
    });
  });

  it('cleans up unauthorized Google sign-ins that are not invited', async () => {
    authDirectory.getIdentityFromAccessToken.mockResolvedValue({
      id: 'user-3',
      email: 'oauth-user@example.com',
      fullName: 'OAuth User',
    });
    authProfilesRepository.findByUserId.mockResolvedValue(null);
    authDirectory.deleteUser.mockResolvedValue();

    await expect(
      sut.loginWithAccessToken({
        accessToken: 'google-access-token',
        userAgent: 'Chrome',
        ipAddress: '127.0.0.1',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(authSessionsRepository.revokeAllForUser).toHaveBeenCalledWith(
      'user-3',
    );
    expect(authDirectory.deleteUser).toHaveBeenCalledWith('user-3');
  });
});
