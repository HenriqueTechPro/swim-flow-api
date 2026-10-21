import { createHash } from 'node:crypto';
import { UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '@/infra/database/prisma/prisma.service';
import { LocalPasswordIdentityService } from './local-password-identity.service';
import { LocalAuthActionTokensService } from './local-auth-action-tokens.service';

describe('LocalAuthActionTokensService', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const email = 'coach@example.invalid';
  const basePassword = 'a-very-strong-password';
  let tx: {
    localAuthIdentity: { findUnique: jest.Mock; updateMany: jest.Mock };
    localAuthActionToken: {
      findUnique: jest.Mock;
      create: jest.Mock;
      updateMany: jest.Mock;
    };
    authSession: { updateMany: jest.Mock };
  };
  let transaction: jest.Mock;
  let hashing: jest.Mock;
  let service: LocalAuthActionTokensService;

  beforeEach(() => {
    tx = {
      localAuthIdentity: {
        findUnique: jest.fn().mockResolvedValue({
          disabledAt: null,
          emailConfirmedAt: null,
          passwordHash: null,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      localAuthActionToken: {
        findUnique: jest.fn().mockResolvedValue({ userId }),
        create: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      authSession: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    transaction = jest.fn((operation: (tx: typeof tx) => unknown) => operation(tx));
    hashing = jest.fn().mockResolvedValue('secure-bcrypt-hash');
    const prisma = { $transaction: transaction } as unknown as PrismaService;
    const passwordService = {
      hashPasswordForProvisioning: hashing,
    } as unknown as LocalPasswordIdentityService;
    service = new LocalAuthActionTokensService(prisma, passwordService);
  });

  it('issues a random 256-bit invitation token; stores only its SHA-256 digest', async () => {
    const { token, expiresAt } = await service.issueForIdentity(userId, 'INVITATION');
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(23 * 3600 * 1000);
    const digest = createHash('sha256').update(token).digest('hex');
    expect(tx.localAuthActionToken.create).toHaveBeenCalledWith({
      data: {
        userId,
        purpose: 'INVITATION',
        tokenHash: digest,
        expiresAt,
      },
    });
    expect(digest).not.toContain(token);
    expect(tx.localAuthActionToken.updateMany).toHaveBeenCalledWith({
      where: { userId, purpose: 'INVITATION', usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
    expect(hashing).not.toHaveBeenCalled();
  });

  it('enforces reset eligibility and uses a 30-minute expiration', async () => {
    tx.localAuthIdentity.findUnique.mockResolvedValue({
      disabledAt: null,
      emailConfirmedAt: new Date(),
      passwordHash: 'existing-bcrypt-hash',
    });
    const issued = await service.issueForIdentity(userId, 'PASSWORD_RESET');
    expect(issued.expiresAt.getTime() - Date.now()).toBeGreaterThan(29 * 60000);
    expect(issued.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(30 * 60000);
  });

  it('rejects disabled accounts and incorrect confirmation state', async () => {
    for (const values of [
      null,
      { disabledAt: new Date(), emailConfirmedAt: null, passwordHash: null },
      { disabledAt: null, emailConfirmedAt: new Date(), passwordHash: 'hash' },
    ]) {
      tx.localAuthIdentity.findUnique.mockResolvedValue(values);
      await expect(service.issueForIdentity(userId, 'INVITATION')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    }
    expect(tx.localAuthActionToken.create).not.toHaveBeenCalled();
  });

  it('atomically redeems a valid invitation and invalidates existing sessions', async () => {
    tx.localAuthIdentity.findUnique.mockResolvedValue({
      email,
      profile: { fullName: 'Swim Coach' },
    });
    const token = (await service.issueForIdentity(userId, 'INVITATION')).token;
    const result = await service.redeemWithPassword(token, 'INVITATION', basePassword);
    expect(result).toEqual({ id: userId, email, fullName: 'Swim Coach' });
    expect(hashing).toHaveBeenCalledWith(basePassword);
    expect(tx.localAuthIdentity.updateMany).toHaveBeenCalledWith({
      where: { userId, disabledAt: null, emailConfirmedAt: null, passwordHash: null },
      data: { passwordHash: 'secure-bcrypt-hash', emailConfirmedAt: expect.any(Date) },
    });
    expect(tx.authSession.updateMany).toHaveBeenCalledWith({
      where: { userId, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('reset updates password only for verified, active identities', async () => {
    tx.localAuthIdentity.findUnique.mockResolvedValue({ email, profile: { fullName: '' } });
    const token = 'a'.repeat(43);
    const result = await service.redeemWithPassword(token, 'PASSWORD_RESET', basePassword);
    expect(result.fullName).toBeNull();
    expect(tx.localAuthIdentity.updateMany).toHaveBeenCalledWith({
      where: {
        userId,
        disabledAt: null,
        emailConfirmedAt: { not: null },
        passwordHash: { not: null },
      },
      data: { passwordHash: 'secure-bcrypt-hash' },
    });
  });

  it('rejects invalid, expired, used or wrong-purpose tokens without updating credentials', async () => {
    await expect(service.redeemWithPassword('too-short', 'INVITATION', basePassword))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(transaction).not.toHaveBeenCalled();
    tx.localAuthActionToken.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.redeemWithPassword('a'.repeat(43), 'INVITATION', basePassword))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(tx.localAuthIdentity.updateMany).not.toHaveBeenCalled();
  });

  it('does not return success if a concurrent identity state change prevents the update', async () => {
    tx.localAuthIdentity.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.redeemWithPassword('a'.repeat(43), 'INVITATION', basePassword))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(tx.authSession.updateMany).not.toHaveBeenCalled();
  });

  it('rejects unknown action purposes before touching the database', async () => {
    await expect(service.issueForIdentity(userId, 'UNEXPECTED' as 'INVITATION'))
      .rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(transaction).not.toHaveBeenCalled();
  });
});
