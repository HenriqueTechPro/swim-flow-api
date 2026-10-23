import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

// Only verified, enabled local identities may use previously issued
// access and refresh tokens. Orphaned Supabase sessions are rejected.
const activeLocalIdentitySession: Prisma.AuthSessionWhereInput = {
  profile: {
    is: {
      localAuthIdentity: {
        is: {
          disabledAt: null,
          emailConfirmedAt: { not: null },
          passwordHash: { not: null },
        },
      },
    },
  },
};

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

  async rotateRefreshSession(
    sessionId: string,
    currentRefreshTokenHash: string,
    replacement: CreateAuthSessionRepositoryInput,
  ): Promise<AuthSession | null> {
    // Lock the prior row FIRST. Under concurrent refresh calls, only one
    // request can observe an unrevoked session and create its successor.
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id" FROM "auth_sessions"
        WHERE "id" = ${sessionId}::uuid FOR UPDATE
      `;

      const current = await tx.authSession.findFirst({
        where: {
          id: sessionId,
          refreshTokenHash: currentRefreshTokenHash,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          ...activeLocalIdentitySession,
        },
      });

      if (
        !current ||
        current.userId !== replacement.userId ||
        current.email !== replacement.email
      ) {
        return null;
      }

      const next = await tx.authSession.create({
        data: {
          userId: current.userId,
          email: current.email,
          refreshTokenHash: replacement.refreshTokenHash,
          expiresAt: replacement.expiresAt,
          userAgent: replacement.userAgent ?? null,
          ipAddress: replacement.ipAddress ?? null,
        },
      });
      // This update and the insert above are ONE transaction. If the
      // conditional update fails, the successor insert must roll back.
      const consumed = await tx.authSession.updateMany({
        where: {
          id: current.id,
          refreshTokenHash: currentRefreshTokenHash,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          ...activeLocalIdentitySession,
        },
        data: {
          revokedAt: new Date(),
          replacedBySessionId: next.id,
        },
      });
      if (consumed.count !== 1) {
        throw new Error('Refresh session changed during rotation');
      }

      return toDomain(next);
    }, { maxWait: 10000, timeout: 20000 });
  }

  async findActiveById(id: string): Promise<AuthSession | null> {
    const session = await this.prisma.authSession.findFirst({
      where: {
        id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        ...activeLocalIdentitySession,
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
        ...activeLocalIdentitySession,
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
        ...activeLocalIdentitySession,
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
