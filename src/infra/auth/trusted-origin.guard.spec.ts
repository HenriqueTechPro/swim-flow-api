import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';
import type { Request } from 'express';
import type { EnvService } from '@/infra/env/env.service';
import { TrustedOriginGuard } from './trusted-origin.guard';

function makeGuard(
  overrides: Partial<Pick<EnvService, 'authCookieSameSite' | 'corsOrigins'>> = {},
) {
  return new TrustedOriginGuard({
    authCookieSameSite: 'none',
    corsOrigins: ['https://app.example.com'],
    ...overrides,
  } as EnvService);
}

function makeExecutionContext(headers: Request['headers']) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as ExecutionContext;
}

describe('TrustedOriginGuard', () => {
  it('allows requests when refresh cookies are same-site protected', () => {
    const guard = makeGuard({ authCookieSameSite: 'lax' });

    expect(guard.canActivate(makeExecutionContext({}))).toBe(true);
  });

  it('allows requests from configured Origin headers', () => {
    const guard = makeGuard();

    expect(
      guard.canActivate(
        makeExecutionContext({ origin: 'https://app.example.com/' }),
      ),
    ).toBe(true);
  });

  it('allows requests from configured Referer headers when Origin is absent', () => {
    const guard = makeGuard();

    expect(
      guard.canActivate(
        makeExecutionContext({ referer: 'https://app.example.com/account' }),
      ),
    ).toBe(true);
  });

  it('rejects requests without Origin or Referer when SameSite is none', () => {
    const guard = makeGuard();

    expect(() => guard.canActivate(makeExecutionContext({}))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects requests from origins outside the allowlist', () => {
    const guard = makeGuard();

    expect(
      () =>
        guard.canActivate(
          makeExecutionContext({ origin: 'https://malicious.example.com' }),
        ),
    ).toThrow(ForbiddenException);
  });

  it('rejects malformed Referer headers', () => {
    const guard = makeGuard();

    expect(() =>
      guard.canActivate(makeExecutionContext({ referer: 'not-a-valid-url' })),
    ).toThrow(ForbiddenException);
  });
});
