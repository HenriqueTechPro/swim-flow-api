import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthSessionsRepository } from '@/domain/auth/application/repositories/auth-sessions-repository';
import { EnvService } from '@/infra/env/env.service';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const verifyAsync = jest.fn();
  const findActiveById = jest.fn();
  const request = {
    headers: { authorization: 'Bearer test-only-jwt' },
    user: undefined as unknown,
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;
  const guard = new JwtAuthGuard(
    { verifyAsync } as unknown as JwtService,
    { findActiveById } as unknown as AuthSessionsRepository,
    { jwtAccessSecret: 'ci-jwt-secret' } as EnvService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    request.headers.authorization = 'Bearer test-only-jwt';
    request.user = undefined;
    verifyAsync.mockResolvedValue({
      sub: 'user-1',
      email: 'stale@example.invalid',
      sessionId: 'session-1',
    });
    findActiveById.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      email: 'current@example.invalid',
    });
  });

  it('uses the verified database session identity, not a stale JWT email', async () => {
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verifyAsync).toHaveBeenCalledWith('test-only-jwt', {
      secret: 'ci-jwt-secret',
    });
    expect(request.user).toEqual({
      id: 'user-1',
      email: 'current@example.invalid',
      sessionId: 'session-1',
    });
  });

  it('rejects missing and malformed Bearer authorization', async () => {
    for (const header of ['bad-token', '', 'Basic foo']) {
      request.headers.authorization = header;
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    }
    expect(findActiveById).not.toHaveBeenCalled();
  });

  it('rejects invalid signature, malformed claims and expired sessions', async () => {
    verifyAsync.mockRejectedValueOnce(new Error('invalid signature'));
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    for (const payload of [
      null,
      {},
      { sub: 42, sessionId: 'session-1' },
      { sub: 'user-1', sessionId: {} },
    ]) {
      verifyAsync.mockResolvedValueOnce(payload);
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    }
    findActiveById.mockResolvedValueOnce(null);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(request.user).toBeUndefined();
  });

  it('rejects a signed JWT for a different session owner', async () => {
    findActiveById.mockResolvedValueOnce({
      id: 'session-1',
      userId: 'another-user',
      email: 'another@example.invalid',
    });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(request.user).toBeUndefined();
  });
});
