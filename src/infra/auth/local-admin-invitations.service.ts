import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AppRole } from '@/domain/auth/application/auth.types';
import { PrismaService } from '@/infra/database/prisma/prisma.service';
import { LocalAuthActionTokensService } from './local-auth-action-tokens.service';
import { LocalInvitationMailSender } from './local-invitation-mail-sender';

const INVITATION_LIFETIME_MS = 24 * 60 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CreateLocalInvitation {
  actorUserId: string;
  email: string;
  fullName?: string;
  role: AppRole;
}

@Injectable()
export class LocalAdminInvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: LocalAuthActionTokensService,
    private readonly mail: LocalInvitationMailSender,
  ) {}

  /** Internal-only workflow; controllers remain on Supabase until cutover. */
  async invite(
    input: CreateLocalInvitation,
  ): Promise<{ id: string; email: string }> {
    // Refuse BEFORE any write if delivery/known frontend is not configured.
    this.mail.assertReady();

    const email =
      typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    const fullName =
      typeof input.fullName === 'string' ? input.fullName.trim() : '';
    if (!EMAIL_PATTERN.test(email) || email.length > 320) {
      throw new UnprocessableEntityException('Invalid invitation email');
    }
    if (
      fullName.length > 120 ||
      !['user', 'teacher', 'admin'].includes(input.role)
    ) {
      throw new UnprocessableEntityException('Invalid invitation profile');
    }
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + INVITATION_LIFETIME_MS);

    let result: { id: string; alreadyPending: boolean };
    try {
      result = await this.prisma.$transaction(async (tx) => {
        // Enforce privileges from the DATABASE, not a user-controlled role.
        const actor = await tx.profile.findUnique({
          where: { id: input.actorUserId },
          select: {
            role: true,
            localAuthIdentity: {
              select: {
                disabledAt: true,
                emailConfirmedAt: true,
                passwordHash: true,
              },
            },
          },
        });
        if (
          actor?.role !== 'admin' ||
          actor.localAuthIdentity?.disabledAt !== null ||
          !actor.localAuthIdentity?.emailConfirmedAt ||
          !actor.localAuthIdentity?.passwordHash
        ) {
          throw new ForbiddenException('Administrator access required');
        }

        const existing = await tx.localAuthIdentity.findUnique({
          where: { email },
          select: {
            userId: true,
            disabledAt: true,
            emailConfirmedAt: true,
            passwordHash: true,
            profile: { select: { role: true } },
          },
        });
        if (existing) {
          if (
            existing.disabledAt !== null ||
            existing.emailConfirmedAt !== null ||
            existing.passwordHash !== null ||
            existing.profile?.role !== input.role
          ) {
            throw new ConflictException(
              'Invitation cannot be issued for this account',
            );
          }
          // Reissue is allowed only for the SAME pending account and role.
          return { id: existing.userId, alreadyPending: true };
        }

        const id = randomUUID();
        await tx.profile.create({
          data: {
            id,
            fullName,
            role: input.role,
            localAuthIdentity: {
              create: {
                email,
                actionTokens: {
                  create: {
                    purpose: 'INVITATION',
                    tokenHash,
                    expiresAt,
                  },
                },
              },
            },
          },
        });
        return { id, alreadyPending: false };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Invitation already exists');
      }
      throw error;
    }

    let deliveryToken = token;
    let deliveryExpiry = expiresAt;
    if (result.alreadyPending) {
      // Reuses 02E-9A's transaction/identity lock to invalidate older links.
      const renewed = await this.tokens.issueForIdentity(
        result.id,
        'INVITATION',
      );
      deliveryToken = renewed.token;
      deliveryExpiry = renewed.expiresAt;
    }
    // A provider failure leaves an unusable pending account, not a credential.
    // An authorized admin may retry; no token is returned in the HTTP response.
    await this.mail.sendInvitation({
      to: email,
      token: deliveryToken,
      expiresAt: deliveryExpiry,
    });
    return { id: result.id, email };
  }
}
