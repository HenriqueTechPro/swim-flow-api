import type { Response } from 'express';
import { EnvService } from '@/infra/env/env.service';
import {
  clearRefreshTokenCookie,
  setRefreshTokenCookie,
} from './refresh-token-cookie';

describe('refresh-token-cookie', () => {
  function makeEnvService() {
    return {
      authRefreshCookieName: 'swim_flow_refresh_token',
      authCookieSameSite: 'none' as const,
      authSecureCookies: true,
      authCookiePath: '/api/auth',
      authCookieDomain: 'app.example.com',
      refreshTokenTtlDays: 7,
    } as EnvService;
  }

  function makeResponse() {
    return {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    } as unknown as Response;
  }

  it('sets the refresh token cookie with the configured scope', () => {
    const response = makeResponse();
    const envService = makeEnvService();

    setRefreshTokenCookie(response, envService, 'refresh-token-value');

    expect(response.cookie).toHaveBeenCalledWith(
      'swim_flow_refresh_token',
      'refresh-token-value',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'none',
        secure: true,
        path: '/api/auth',
        domain: 'app.example.com',
      }),
    );
  });

  it('clears the refresh token cookie with the same configured scope', () => {
    const response = makeResponse();
    const envService = makeEnvService();

    clearRefreshTokenCookie(response, envService);

    expect(response.clearCookie).toHaveBeenCalledWith(
      'swim_flow_refresh_token',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'none',
        secure: true,
        path: '/api/auth',
        domain: 'app.example.com',
      }),
    );
  });
});
