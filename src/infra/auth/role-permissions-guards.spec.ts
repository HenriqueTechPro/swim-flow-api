import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthProfilesRepository } from '@/domain/auth/application/repositories/auth-profiles-repository';
import { RolesGuard } from './roles.guard';
import { PermissionsGuard } from './permissions.guard';

describe('RolesGuard + PermissionsGuard fail-closed authorization', () => {
  const request = {
    user: {
      id: 'user-1',
      email: 'user@example.invalid',
      sessionId: 'session-1',
      role: 'admin',
      permissions: ['auth:manage-users', 'auth:invite'],
    },
  };
  const context = {
    getHandler: () => () => {},
    getClass: () => class TestController {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const getAllAndOverride = jest.fn();
  const findByUserId = jest.fn();
  const reflector = { getAllAndOverride } as unknown as Reflector;
  const roles = new RolesGuard(reflector, {
    findByUserId,
  } as unknown as AuthProfilesRepository);
  const permissions = new PermissionsGuard(reflector);

  beforeEach(() => {
    jest.resetAllMocks();
    request.user = {
      id: 'user-1',
      email: 'user@example.invalid',
      sessionId: 'session-1',
      role: 'admin',
      permissions: ['auth:manage-users', 'auth:invite'],
    };
  });

  it('denies a teacher even if a stale request claimed to be admin', async () => {
    getAllAndOverride.mockReturnValueOnce(['admin']);
    findByUserId.mockResolvedValueOnce({
      id: 'user-1',
      role: 'teacher',
      permissions: ['attendance:write'],
    });
    await expect(roles.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(request.user.role).toBe('teacher');
  });

  it('rejects an unauthorized teacher permission despite forged grants', async () => {
    getAllAndOverride.mockReturnValueOnce(['teacher', 'admin']);
    findByUserId.mockResolvedValueOnce({
      id: 'user-1',
      role: 'teacher',
      permissions: ['auth:manage-users', 'students:read'],
    });
    await expect(roles.canActivate(context)).resolves.toBe(true);
    getAllAndOverride.mockReturnValueOnce(['auth:manage-users']);
    expect(() => permissions.canActivate(context)).toThrow(ForbiddenException);
    expect(request.user.permissions).not.toContain('auth:manage-users');
  });

  it('allows a current administrator to manage users', async () => {
    getAllAndOverride.mockReturnValueOnce(['admin']);
    findByUserId.mockResolvedValueOnce({
      id: 'user-1',
      role: 'admin',
      permissions: ['auth:manage-users', 'auth:invite'],
    });
    await expect(roles.canActivate(context)).resolves.toBe(true);
    getAllAndOverride.mockReturnValueOnce(['auth:manage-users']);
    expect(permissions.canActivate(context)).toBe(true);
  });

  it('rejects access when the profile was removed while the JWT remains valid', async () => {
    getAllAndOverride.mockReturnValueOnce(['admin']);
    findByUserId.mockResolvedValueOnce(null);
    await expect(roles.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
