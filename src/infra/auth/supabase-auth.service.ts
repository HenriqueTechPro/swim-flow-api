import { Injectable, UnauthorizedException } from '@nestjs/common'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { EnvService } from '@/infra/env/env.service'

@Injectable()
export class SupabaseAuthService {
  private readonly client: SupabaseClient

  constructor(private readonly envService: EnvService) {
    this.client = createClient(this.envService.supabaseUrl, this.envService.supabasePublishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  }

  async getUserFromToken(token: string): Promise<User> {
    const { data, error } = await this.client.auth.getUser(token)

    if (error || !data.user) {
      throw new UnauthorizedException('Invalid Supabase token')
    }

    return data.user
  }
}
