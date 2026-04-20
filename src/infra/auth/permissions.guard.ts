import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PERMISSIONS_KEY } from './permissions.decorator';
import type { AppPermission, AuthUser } from './auth.types';
import { getPermissionsForRole } from './role-permissions';

interface AuthenticatedRequest extends Request {
  user?: Partial<AuthUser>;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const requiredPermissions =
      this.reflector.getAllAndOverride<AppPermission[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authUser = request.user;

    if (!authUser?.role) {
      throw new ForbiddenException('User role not resolved');
    }

    const permissions =
      authUser.permissions ?? getPermissionsForRole(authUser.role);

    request.user = {
      ...authUser,
      permissions,
    };

    const missingPermissions = requiredPermissions.filter(
      (permission) => !permissions.includes(permission),
    );

    if (missingPermissions.length > 0) {
      throw new ForbiddenException(
        'User does not have permission for this action',
      );
    }

    return true;
  }
}
