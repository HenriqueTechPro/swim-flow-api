import { Injectable } from '@nestjs/common';
import { env } from './env';

@Injectable()
export class EnvService {
  get databaseUrl() {
    return env.databaseUrl;
  }

  get supabaseUrl() {
    return env.supabaseUrl;
  }

  get supabasePublishableKey() {
    return env.supabasePublishableKey;
  }

  get supabaseServiceRoleKey() {
    return env.supabaseServiceRoleKey;
  }

  get jwtAccessSecret() {
    return env.jwtAccessSecret;
  }

  get jwtAccessTtlSeconds() {
    return env.jwtAccessTtlSeconds;
  }

  get refreshTokenTtlDays() {
    return env.refreshTokenTtlDays;
  }

  get authRefreshCookieName() {
    return env.authRefreshCookieName;
  }

  get authCookieSameSite() {
    return env.authCookieSameSite;
  }

  get authCookieDomain() {
    return env.authCookieDomain;
  }

  get authCookiePath() {
    return env.authCookiePath;
  }

  get authSecureCookies() {
    return env.authSecureCookies;
  }

  get corsOrigins() {
    return env.corsOrigins;
  }

  get cacheTtlSeconds() {
    return env.cacheTtlSeconds;
  }

  get port() {
    return env.port;
  }
}
