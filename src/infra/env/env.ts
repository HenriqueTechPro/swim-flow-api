import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'

const appRoot = resolve(__dirname, '../../../')

const loadEnvFile = (filepath: string) => {
  if (!existsSync(filepath)) return

  const content = readFileSync(filepath, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) continue

    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '')

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

loadEnvFile(resolve(appRoot, '.env'))
loadEnvFile(resolve(appRoot, '.env.local'))

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  API_CORS_ORIGIN: z.string().default('http://localhost:8080'),
  CACHE_TTL_SECONDS: z.coerce.number().default(30),
  NEST_API_PORT: z.coerce.number().default(3334),
  SWAGGER_ENABLED: z.coerce.boolean().default(true),
  SWAGGER_PATH: z.string().default('docs'),
})

const parsedEnv = envSchema.parse(process.env)
const corsOrigins = parsedEnv.API_CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)

export const env = {
  databaseUrl: parsedEnv.DATABASE_URL,
  supabaseUrl: parsedEnv.VITE_SUPABASE_URL,
  supabasePublishableKey: parsedEnv.VITE_SUPABASE_PUBLISHABLE_KEY,
  corsOrigin: parsedEnv.API_CORS_ORIGIN,
  corsOrigins,
  cacheTtlSeconds: parsedEnv.CACHE_TTL_SECONDS,
  port: parsedEnv.NEST_API_PORT,
  swaggerEnabled: parsedEnv.SWAGGER_ENABLED,
  swaggerPath: parsedEnv.SWAGGER_PATH,
}