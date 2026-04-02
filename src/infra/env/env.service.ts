import { Injectable } from '@nestjs/common'
import { env } from './env'

@Injectable()
export class EnvService {
  get databaseUrl() {
    return env.databaseUrl
  }

  get supabaseUrl() {
    return env.supabaseUrl
  }

  get supabasePublishableKey() {
    return env.supabasePublishableKey
  }

  get corsOrigin() {
    return env.corsOrigin
  }

  get cacheTtlSeconds() {
    return env.cacheTtlSeconds
  }

  get port() {
    return env.port
  }
}
