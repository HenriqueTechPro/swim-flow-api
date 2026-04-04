import { Injectable, type CanActivate, type ExecutionContext, UnauthorizedException } from '@nestjs/common'
import type { Request } from 'express'
import { SupabaseAuthService } from './supabase-auth.service'

interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email: string | null
  }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly supabaseAuthService: SupabaseAuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const header = request.headers.authorization

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token')
    }

    const token = header.slice('Bearer '.length)
    const user = await this.supabaseAuthService.getUserFromToken(token)

    request.user = {
      id: user.id,
      email: user.email ?? null,
    }

    return true
  }
}
