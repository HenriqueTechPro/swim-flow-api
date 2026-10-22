import { Injectable, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '@/infra/database/prisma/prisma.service';
import { LocalAuthActionTokensService } from './local-auth-action-tokens.service';
import { LocalPasswordResetMailSender } from './local-password-reset-mail-sender';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Internal-only preparation for provider-independent password recovery.
 * No HTTP route is wired. A future public controller MUST provide request
 * rate limiting, trusted origins and a generic success response.
 */
@Injectable()
export class LocalPasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: LocalAuthActionTokensService,
    private readonly mail: LocalPasswordResetMailSender,
  ) {}

  async request(emailInput: string): Promise<{ success: true }> {
    // Check globally configured delivery BEFORE any identity lookup.
    // Misconfiguration must never reveal the existence of a user account.
    this.mail.assertReady();
    const email =
      typeof emailInput === 'string' ? emailInput.trim().toLowerCase() : '';
    if (!EMAIL_PATTERN.test(email) || email.length > 320) {
      return { success: true };
    }
    const identity = await this.prisma.localAuthIdentity.findUnique({
      where: { email },
      select: {
        userId: true,
        email: true,
        emailConfirmedAt: true,
        disabledAt: true,
        passwordHash: true,
      },
    });
    if (
      !identity ||
      identity.disabledAt !== null ||
      !identity.emailConfirmedAt ||
      !identity.passwordHash
    ) {
      return { success: true };
    }
    try {
      const { token, expiresAt } = await this.tokens.issueForIdentity(
        identity.userId,
        'PASSWORD_RESET',
      );
      await this.mail.sendReset({ to: identity.email, token, expiresAt });
    } catch (error) {
      if (
        !(error instanceof UnprocessableEntityException) &&
        !(error instanceof ServiceUnavailableException)
      ) {
        throw error;
      }
      // A revoked account / failed delivery must not change the public reply.
      // Never log plaintext tokens, recipient or remote provider response.
    }
    return { success: true };
  }
}
