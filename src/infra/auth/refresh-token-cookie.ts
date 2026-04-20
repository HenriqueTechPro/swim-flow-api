import type { CookieOptions, Request, Response } from 'express';
import type { EnvService } from '@/infra/env/env.service';

function buildRefreshTokenCookieScope(
  envService: EnvService,
): Pick<CookieOptions, 'domain' | 'httpOnly' | 'path' | 'sameSite' | 'secure'> {
  return {
    domain: envService.authCookieDomain ?? undefined,
    httpOnly: true,
    sameSite: envService.authCookieSameSite,
    secure: envService.authSecureCookies,
    path: envService.authCookiePath,
  };
}

export function setRefreshTokenCookie(
  response: Response,
  envService: EnvService,
  refreshToken: string,
) {
  response.cookie(envService.authRefreshCookieName, refreshToken, {
    ...buildRefreshTokenCookieScope(envService),
    maxAge:
      envService.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshTokenCookie(
  response: Response,
  envService: EnvService,
) {
  response.clearCookie(envService.authRefreshCookieName, {
    ...buildRefreshTokenCookieScope(envService),
  });
}

export function getRefreshTokenFromRequest(
  request: Request,
  envService: EnvService,
) {
  const cookieValue = request.cookies?.[envService.authRefreshCookieName];
  return typeof cookieValue === 'string' && cookieValue.length > 0
    ? cookieValue
    : null;
}
