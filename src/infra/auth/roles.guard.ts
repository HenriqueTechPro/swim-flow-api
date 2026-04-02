import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import { PrismaService } from '@/infra/database/prisma/prisma.service'
import { ROLES_KEY } from './roles.decorator'
import type { AuthUser } from './auth.types'

interface AuthenticatedRequest extends Request {
  user?: Partial<AuthUser>
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!roles || roles.length === 0) {
      return true
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const authUser = request.user

    if (!authUser?.id) {
      throw new ForbiddenException('User not authenticated')
    }

    const profile = await this.prisma.profile.findUnique({
      where: { id: authUser.id },
      select: { role: true },
    })

    if (!profile?.role) {
      throw new ForbiddenException('Profile not found for authenticated user')
    }

    request.user = {
      ...authUser,
      role: profile.role as AuthUser['role'],
    }

    if (!roles.includes(request.user.role!)) {
      throw new ForbiddenException('User does not have permission for this resource')
    }

    return true
  }
}
