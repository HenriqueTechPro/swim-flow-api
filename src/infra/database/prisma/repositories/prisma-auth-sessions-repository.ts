import { Injectable } from '@nestjs/common';
import {
  AuthSessionsRepository,
  type CreateAuthSessionRepositoryInput,
} from '@/domain/auth/application/repositories/auth-sessions-repository';
import type { AuthSession } from '@/domain/auth/enterprise/entities/auth-session';
import { PrismaService } from '../prisma.service';

function toDomain(session: {
  id: string;
  userId: string;
  email: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedBySessionId: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AuthSession {
  return {
    id: session.id,
    userId: session.userId,
    email: session.email,
    refreshTokenHash: session.refreshTokenHash,
    expiresAt: session.expiresAt,
    revokedAt: session.revokedAt,
    replacedBySessionId: session.replacedBySessionId,
    userAgent: session.userAgent,
    ipAddress: session.ipAddress,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

@Injectable()
export class PrismaAuthSessionsRepository implements AuthSessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateAuthSessionRepositoryInput): Promise<AuthSession> {
    const session = await this.prisma.authSession.create({
      data: {
        userId: input.userId,
        email: input.email,
        refreshTokenHash: input.refreshTokenHash,
        expiresAt: input.expiresAt,
        userAgent: input.userAgent ?? null,
        ipAddress: input.ipAddress ?? null,
      },
    });

    return toDomain(session);
  }

  async findActiveById(id: string): Promise<AuthSession | null> {
    const session = await this.prisma.authSession.findFirst({
      where: {
        id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    return session ? toDomain(session) : null;
  }

  async findByRefreshTokenHash(
    refreshTokenHash: string,
  ): Promise<AuthSession | null> {
    const session = await this.prisma.authSession.findFirst({
      where: {
        refreshTokenHash,
      },
    });

    return session ? toDomain(session) : null;
  }

  async findActiveByRefreshTokenHash(
    refreshTokenHash: string,
  ): Promise<AuthSession | null> {
    const session = await this.prisma.authSession.findFirst({
      where: {
        refreshTokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    return session ? toDomain(session) : null;
  }

  async revoke(id: string, replacedBySessionId?: string | null): Promise<void> {
    await this.prisma.authSession.update({
      where: { id },
      data: {
        revokedAt: new Date(),
        replacedBySessionId: replacedBySessionId ?? null,
      },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}
