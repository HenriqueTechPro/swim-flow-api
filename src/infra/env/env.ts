import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { parseCorsOrigins } from '@/infra/http/cors/cors.config';

const appRoot = process.cwd();
const defaultDevelopmentJwtAccessSecret =
  'development-jwt-access-secret-change-me';
const optionalNonEmptyString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

const loadEnvFile = (filepath: string) => {
  if (!existsSync(filepath)) return;

  const content = readFileSync(filepath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
};

loadEnvFile(resolve(appRoot, '.env'));
loadEnvFile(resolve(appRoot, '.env.local'));

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: optionalNonEmptyString,
  SUPABASE_SERVICE_ROLE_KEY: optionalNonEmptyString,
  JWT_ACCESS_SECRET: z
    .string()
    .min(32)
    .default(defaultDevelopmentJwtAccessSecret),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  AUTH_REFRESH_COOKIE_NAME: z.string().min(1).default('swim_flow_refresh_token'),
  AUTH_COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  AUTH_COOKIE_DOMAIN: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  AUTH_COOKIE_PATH: z.string().trim().min(1).default('/api/auth'),
  AUTH_SECURE_COOKIES: z.coerce.boolean().default(false),
  API_CORS_ORIGIN: z
    .string()
    .default('http://localhost:8080')
    .transform(parseCorsOrigins)
    .refine((origins) => origins.length > 0, {
      message: 'API_CORS_ORIGIN must include at least one origin',
    }),
  CACHE_TTL_SECONDS: z.coerce.number().default(30),
  NEST_API_PORT: z.coerce.number().default(3334),
  SWAGGER_ENABLED: z
    .coerce.boolean()
    .default(process.env.NODE_ENV !== 'production'),
  SWAGGER_PATH: z.string().default('docs'),
});

const parsedEnv = envSchema.parse(process.env);

if (
  process.env.NODE_ENV === 'production' &&
  parsedEnv.JWT_ACCESS_SECRET === defaultDevelopmentJwtAccessSecret
) {
  throw new Error('JWT_ACCESS_SECRET must be configured in production');
}

if (
  parsedEnv.AUTH_COOKIE_SAME_SITE === 'none' &&
  !parsedEnv.AUTH_SECURE_COOKIES
) {
  throw new Error(
    'AUTH_SECURE_COOKIES must be true when AUTH_COOKIE_SAME_SITE is none',
  );
}

export const env = {
  databaseUrl: parsedEnv.DATABASE_URL,
  supabaseUrl: parsedEnv.VITE_SUPABASE_URL,
  supabasePublishableKey: parsedEnv.VITE_SUPABASE_PUBLISHABLE_KEY,
  supabaseServiceRoleKey:
    parsedEnv.SUPABASE_SECRET_KEY ??
    parsedEnv.SUPABASE_SERVICE_ROLE_KEY ??
    null,
  jwtAccessSecret: parsedEnv.JWT_ACCESS_SECRET,
  jwtAccessTtlSeconds: parsedEnv.JWT_ACCESS_TTL_SECONDS,
  refreshTokenTtlDays: parsedEnv.REFRESH_TOKEN_TTL_DAYS,
  authRefreshCookieName: parsedEnv.AUTH_REFRESH_COOKIE_NAME,
  authCookieSameSite: parsedEnv.AUTH_COOKIE_SAME_SITE,
  authCookieDomain: parsedEnv.AUTH_COOKIE_DOMAIN ?? null,
  authCookiePath: parsedEnv.AUTH_COOKIE_PATH,
  authSecureCookies: parsedEnv.AUTH_SECURE_COOKIES,
  corsOrigins: parsedEnv.API_CORS_ORIGIN,
  cacheTtlSeconds: parsedEnv.CACHE_TTL_SECONDS,
  port: parsedEnv.NEST_API_PORT,
  swaggerEnabled: parsedEnv.SWAGGER_ENABLED,
  swaggerPath: parsedEnv.SWAGGER_PATH,
};
