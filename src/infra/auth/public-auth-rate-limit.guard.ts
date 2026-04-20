import {
  HttpException,
  HttpStatus,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

type RateLimitedHandler =
  | 'login'
  | 'loginWithGoogle'
  | 'refresh'
  | 'requestPasswordReset'
  | 'confirmPasswordReset';

interface RateLimitWindow {
  limit: number;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const RATE_LIMIT_WINDOWS: Record<RateLimitedHandler, RateLimitWindow> = {
  login: { limit: 5, windowMs: 60_000 },
  loginWithGoogle: { limit: 20, windowMs: 60_000 },
  refresh: { limit: 30, windowMs: 60_000 },
  requestPasswordReset: { limit: 3, windowMs: 15 * 60_000 },
  confirmPasswordReset: { limit: 5, windowMs: 15 * 60_000 },
};

@Injectable()
export class PublicAuthRateLimitGuard implements CanActivate {
  private readonly counters = new Map<string, RateLimitEntry>();

  canActivate(context: ExecutionContext) {
    const handlerName = context.getHandler().name as RateLimitedHandler;
    const config = RATE_LIMIT_WINDOWS[handlerName];

    if (!config) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const key = this.buildKey(handlerName, request);
    const now = Date.now();

    this.cleanupExpiredEntries(now);

    const current = this.counters.get(key);
    if (!current || current.resetAt <= now) {
      this.counters.set(key, {
        count: 1,
        resetAt: now + config.windowMs,
      });
      return true;
    }

    if (current.count >= config.limit) {
      throw new HttpException(
        'Too many authentication attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    current.count += 1;
    this.counters.set(key, current);
    return true;
  }

  private buildKey(handlerName: RateLimitedHandler, request: Request) {
    const ip = request.ip ?? request.socket.remoteAddress ?? 'unknown';

    switch (handlerName) {
      case 'login':
      case 'requestPasswordReset': {
        const email = this.normalizeValue(request.body?.email);
        return `${handlerName}:${ip}:${email ?? 'anonymous'}`;
      }
      case 'confirmPasswordReset': {
        const accessToken = this.normalizeValue(request.body?.accessToken);
        return `${handlerName}:${ip}:${accessToken ?? 'anonymous'}`;
      }
      default:
        return `${handlerName}:${ip}`;
    }
  }

  private normalizeValue(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0
      ? value.trim().toLowerCase()
      : null;
  }

  private cleanupExpiredEntries(now: number) {
    if (this.counters.size < 500) {
      return;
    }

    for (const [key, entry] of this.counters.entries()) {
      if (entry.resetAt <= now) {
        this.counters.delete(key);
      }
    }
  }
}
