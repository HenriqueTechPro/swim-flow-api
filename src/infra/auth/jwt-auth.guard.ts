import { Injectable, type CanActivate, type ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { createClient } from '@supabase/supabase-js'
import type { Request } from 'express'
import { EnvService } from '@/infra/env/env.service'

interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email: string | null
  }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly envService: EnvService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const header = request.headers.authorization

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token')
    }

    const token = header.slice('Bearer '.length)
    const supabase = createClient(
      this.envService.supabaseUrl,
      this.envService.supabasePublishableKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    )

    const { data, error } = await supabase.auth.getUser(token)

    if (error || !data.user) {
      throw new UnauthorizedException('Invalid Supabase token')
    }

    request.user = {
      id: data.user.id,
      email: data.user.email ?? null,
    }

    return true
  }
}
