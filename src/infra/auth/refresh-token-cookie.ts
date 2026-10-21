import type { CookieOptions, Request, Response } from 'express';
import type { EnvService } from '@/infra/env/env.service';

function buildRefreshTokenCookieScope(
  envService: EnvService,
): Pick<CookieOptions, 'domain' | 'httpOnly' | 'path' | 'sameSite' | 'secure'> {
  const cookieScope: Pick<
    CookieOptions,
    'domain' | 'httpOnly' | 'path' | 'sameSite' | 'secure'
  > = {
    httpOnly: true,
    sameSite: envService.authCookieSameSite,
    secure: envService.authSecureCookies,
    path: envService.authCookiePath,
  };

  const normalizedDomain = normalizeCookieDomain(envService.authCookieDomain);
  if (normalizedDomain) {
    cookieScope.domain = normalizedDomain;
  }

  return cookieScope;
}

function normalizeCookieDomain(domain: string | null) {
  if (!domain) {
    return undefined;
  }

  let normalizedDomain = domain.trim();
  if (normalizedDomain.length === 0) {
    return undefined;
  }

  if (normalizedDomain.includes('://')) {
    try {
      normalizedDomain = new URL(normalizedDomain).hostname;
    } catch {
      return undefined;
    }
  }

  normalizedDomain = normalizedDomain.replace(/:\d+$/, '').trim();

  if (
    normalizedDomain.length === 0 ||
    normalizedDomain.toLowerCase() === 'localhost'
  ) {
    return undefined;
  }

  return normalizedDomain;
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
  const cookies: unknown = request.cookies;
  if (cookies === null || typeof cookies !== 'object') return null;
  const cookieValue: unknown = Reflect.get(
    cookies,
    envService.authRefreshCookieName,
  );
  return typeof cookieValue === 'string' && cookieValue.length > 0
    ? cookieValue
    : null;
}
