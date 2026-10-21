import { randomBytes, createHash } from 'node:crypto';
import {
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { AuthIdentity } from '@/domain/auth/application/repositories/auth-directory-repository';
import { PrismaService } from '@/infra/database/prisma/prisma.service';
import { LocalPasswordIdentityService } from './local-password-identity.service';

export type LocalActionPurpose = 'INVITATION' | 'PASSWORD_RESET';

const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const invalidAction = 'Invalid or expired authentication action';
const durations: Readonly<Record<LocalActionPurpose, number>> = {
  INVITATION: 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 30 * 60 * 1000,
};

function assertPurpose(value: LocalActionPurpose): void {
  if (value !== 'INVITATION' && value !== 'PASSWORD_RESET') {
    throw new UnprocessableEntityException('Unsupported authentication action');
  }
}

function digestToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export interface IssuedLocalAction {
  /** Secret for the trusted mail adapter ONLY; never return in an HTTP body/log. */
  token: string;
  expiresAt: Date;
}

@Injectable()
export class LocalAuthActionTokensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: LocalPasswordIdentityService,
  ) {}

  /**
   * Internal-only issuance. Authorization and mail delivery will be wired in
   * subsequent stages; this method must never be mapped to a public endpoint.
   */
  async issueForIdentity(
    userId: string,
    purpose: LocalActionPurpose,
  ): Promise<IssuedLocalAction> {
    assertPurpose(purpose);
    const token = randomBytes(32).toString('base64url');
    const tokenHash = digestToken(token);

    return this.prisma.$transaction(async (tx) => {
      // Serialize reissuance per identity; only the newest link stays active.
      await tx.$queryRaw`
        SELECT "user_id" FROM "local_auth_identities"
        WHERE "user_id" = ${userId}::uuid FOR UPDATE
      `;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + durations[purpose]);
      const identity = await tx.localAuthIdentity.findUnique({
        where: { userId },
        select: {
          disabledAt: true,
          emailConfirmedAt: true,
          passwordHash: true,
        },
      });
      const eligible =
        identity?.disabledAt === null &&
        (purpose === 'INVITATION'
          ? identity.emailConfirmedAt === null && identity.passwordHash === null
          : identity.emailConfirmedAt !== null &&
            identity.passwordHash !== null);

      if (!eligible) {
        throw new UnprocessableEntityException(
          'Identity not eligible for this action',
        );
      }

      // Invalidate earlier links of the same purpose before issuing a fresh one.
      await tx.localAuthActionToken.updateMany({
        where: { userId, purpose, usedAt: null },
        data: { usedAt: now },
      });
      await tx.localAuthActionToken.create({
        data: { userId, purpose, tokenHash, expiresAt },
      });
      return { token, expiresAt };
    });
  }

  /**
   * Atomic single-use exchange: token consumption, credential update and
   * session revocation succeed together or all roll back.
   */
  async redeemWithPassword(
    token: string,
    purpose: LocalActionPurpose,
    password: string,
  ): Promise<AuthIdentity> {
    assertPurpose(purpose);
    if (typeof token !== 'string' || !tokenPattern.test(token)) {
      throw new UnauthorizedException(invalidAction);
    }
    const passwordHash =
      await this.passwords.hashPasswordForProvisioning(password);
    const tokenHash = digestToken(token);

    return this.prisma.$transaction(async (tx) => {
      // Read the token without locking it, then acquire the identity lock.
      // Issuance also locks identity first: consistent order prevents deadlocks.
      const action = await tx.localAuthActionToken.findUnique({
        where: { tokenHash },
        select: { userId: true },
      });
      if (!action) {
        throw new UnauthorizedException(invalidAction);
      }
      await tx.$queryRaw`
        SELECT "user_id" FROM "local_auth_identities"
        WHERE "user_id" = ${action.userId}::uuid FOR UPDATE
      `;
      const now = new Date();
      // Re-check the token after acquiring the lock; reissuance may have
      // consumed it while this transaction waited.
      const consumed = await tx.localAuthActionToken.updateMany({
        where: {
          tokenHash,
          purpose,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) {
        throw new UnauthorizedException(invalidAction);
      }

      const updated = await tx.localAuthIdentity.updateMany({
        where: {
          userId: action.userId,
          disabledAt: null,
          ...(purpose === 'INVITATION'
            ? { emailConfirmedAt: null, passwordHash: null }
            : { emailConfirmedAt: { not: null }, passwordHash: { not: null } }),
        },
        data: {
          passwordHash,
          ...(purpose === 'INVITATION' ? { emailConfirmedAt: now } : {}),
        },
      });
      if (updated.count !== 1) {
        throw new UnauthorizedException(invalidAction);
      }

      await tx.authSession.updateMany({
        where: { userId: action.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      const identity = await tx.localAuthIdentity.findUnique({
        where: { userId: action.userId },
        select: { email: true, profile: { select: { fullName: true } } },
      });
      if (!identity?.profile) {
        throw new UnauthorizedException(invalidAction);
      }
      return {
        id: action.userId,
        email: identity.email,
        fullName: identity.profile.fullName || null,
      };
    });
  }
}
