import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'
import type { AuthUser } from './auth.types'

interface AuthenticatedRequest extends Request {
  user?: AuthUser
}

export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
  return request.user
})
