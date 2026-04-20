import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { EnvService } from '@/infra/env/env.service';
import {
  isCorsOriginAllowed,
  normalizeCorsOrigin,
} from '@/infra/http/cors/cors.config';

@Injectable()
export class TrustedOriginGuard implements CanActivate {
  constructor(private readonly envService: EnvService) {}

  canActivate(context: ExecutionContext) {
    if (this.envService.authCookieSameSite !== 'none') {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const requestOrigin = this.resolveRequestOrigin(request);

    if (!requestOrigin) {
      throw new ForbiddenException(
        'Missing trusted request origin for cookie-based authentication',
      );
    }

    if (!isCorsOriginAllowed(requestOrigin, this.envService.corsOrigins)) {
      throw new ForbiddenException('Request origin is not allowed');
    }

    return true;
  }

  private resolveRequestOrigin(request: Request) {
    const originHeader = this.readHeaderValue(request.headers.origin);
    if (originHeader) {
      return normalizeCorsOrigin(originHeader);
    }

    const refererHeader = this.readHeaderValue(request.headers.referer);
    if (!refererHeader) {
      return null;
    }

    try {
      return normalizeCorsOrigin(new URL(refererHeader).origin);
    } catch {
      throw new ForbiddenException('Request origin is not allowed');
    }
  }

  private readHeaderValue(value: string | string[] | undefined) {
    const rawValue = Array.isArray(value) ? value[0] : value;

    return typeof rawValue === 'string' && rawValue.trim().length > 0
      ? rawValue.trim()
      : null;
  }
}
