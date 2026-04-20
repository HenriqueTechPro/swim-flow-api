import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AuthSessionsRepository } from '@/domain/auth/application/repositories/auth-sessions-repository';
import { EnvService } from '@/infra/env/env.service';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string | null;
    sessionId: string;
  };
}

interface AccessTokenPayload {
  sub: string;
  email?: string | null;
  sessionId: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authSessionsRepository: AuthSessionsRepository,
    private readonly envService: EnvService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = header.slice('Bearer '.length);
    let payload: AccessTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.envService.jwtAccessSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    if (!payload.sub || !payload.sessionId) {
      throw new UnauthorizedException('Invalid access token');
    }

    const session = await this.authSessionsRepository.findActiveById(
      payload.sessionId,
    );

    if (!session || session.userId !== payload.sub) {
      throw new UnauthorizedException('Session is invalid or expired');
    }

    request.user = {
      id: payload.sub,
      email: payload.email ?? null,
      sessionId: payload.sessionId,
    };

    return true;
  }
}
