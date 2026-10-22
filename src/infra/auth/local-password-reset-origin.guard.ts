import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { EnvService } from '@/infra/env/env.service';
import { isCorsOriginAllowed } from '@/infra/http/cors/cors.config';

@Injectable()
export class LocalPasswordResetOriginGuard implements CanActivate {
  constructor(private readonly env: EnvService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const raw = request.headers.origin;
    if (typeof raw !== 'string') {
      throw new ForbiddenException('Trusted request origin is required');
    }
    let origin: URL;
    try {
      origin = new URL(raw);
    } catch {
      throw new ForbiddenException('Request origin is not allowed');
    }
    if (
      raw !== origin.origin ||
      !['http:', 'https:'].includes(origin.protocol) ||
      this.env.corsOrigins.length === 0 ||
      !isCorsOriginAllowed(origin.origin, this.env.corsOrigins)
    ) {
      throw new ForbiddenException('Request origin is not allowed');
    }
    return true;
  }
}
