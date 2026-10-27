import { Injectable, UnauthorizedException } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import type {
  AuthDirectoryUser,
  AuthIdentity,
} from '@/domain/auth/application/repositories/auth-directory-repository';
import { PrismaService } from '@/infra/database/prisma/prisma.service';

const BCRYPT_COST = 12;
const INVALID_CREDENTIALS = 'Invalid login credentials';

// Make unknown-email attempts do a real password comparison too.
let dummyPasswordHash: Promise<string> | undefined;

function getDummyPasswordHash(): Promise<string> {
  dummyPasswordHash ??= hash(
    'unusable-password-for-missing-local-accounts',
    BCRYPT_COST,
  );
  return dummyPasswordHash;
}

@Injectable()
export class LocalPasswordIdentityService {
  constructor(private readonly prisma: PrismaService) {}

  async signInWithPassword(
    email: string,
    password: string,
  ): Promise<AuthIdentity> {
    const canonicalEmail = email.trim().toLowerCase();
    const identity = await this.prisma.localAuthIdentity.findUnique({
      where: { email: canonicalEmail },
      select: {
        userId: true,
        email: true,
        passwordHash: true,
        emailConfirmedAt: true,
        disabledAt: true,
        profile: {
          select: { fullName: true },
        },
      },
    });

    const passwordHash =
      identity?.passwordHash ?? (await getDummyPasswordHash());
    let validPassword = false;
    try {
      validPassword = await compare(password, passwordHash);
    } catch {
      // Malformed stored hashes must never result in a successful login.
    }

    if (
      !validPassword ||
      !identity?.passwordHash ||
      !identity.emailConfirmedAt ||
      identity.disabledAt !== null ||
      !identity.profile
    ) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    // Prevent accepting a password that was reset or a user that was
    // disabled while the bcrypt comparison was in progress.
    const updated = await this.prisma.localAuthIdentity.updateMany({
      where: {
        userId: identity.userId,
        passwordHash: identity.passwordHash,
        disabledAt: null,
        emailConfirmedAt: { not: null },
      },
      data: { lastSignInAt: new Date() },
    });

    if (updated.count !== 1) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    return {
      id: identity.userId,
      email: identity.email,
      fullName: identity.profile.fullName || null,
    };
  }

  /** Non-credential projection for the administrator-only access directory. */
  async listUsers(): Promise<AuthDirectoryUser[]> {
    const identities = await this.prisma.localAuthIdentity.findMany({
      where: { disabledAt: null },
      select: {
        userId: true,
        email: true,
        createdAt: true,
        lastSignInAt: true,
        emailConfirmedAt: true,
      },
      orderBy: [{ createdAt: 'asc' }, { userId: 'asc' }],
    });

    return identities.map((identity) => ({
      id: identity.userId,
      email: identity.email,
      createdAt: identity.createdAt,
      lastSignInAt: identity.lastSignInAt,
      emailConfirmedAt: identity.emailConfirmedAt,
    }));
  }

  async hashPasswordForProvisioning(password: string): Promise<string> {
    const byteLength = Buffer.byteLength(password, 'utf8');
    if (byteLength < 12 || byteLength > 72) {
      throw new Error('Password must have between 12 and 72 UTF-8 bytes');
    }

    return hash(password, BCRYPT_COST);
  }
}
