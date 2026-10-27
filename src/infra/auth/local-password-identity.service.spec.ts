import { UnauthorizedException } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '@/infra/database/prisma/prisma.service';
import { LocalPasswordIdentityService } from './local-password-identity.service';

describe('LocalPasswordIdentityService', () => {
  const password = 'a-strong-password-for-swim-flow';
  const storedEmail = 'coach@example.invalid';
  const userId = '11111111-1111-4111-8111-111111111111';

  let findUnique: jest.Mock;
  let updateMany: jest.Mock;
  let service: LocalPasswordIdentityService;
  let storedHash: string;

  beforeAll(async () => {
    storedHash = await hash(password, 4);
  });

  beforeEach(() => {
    findUnique = jest.fn();
    updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      localAuthIdentity: { findUnique, updateMany },
    } as unknown as PrismaService;
    service = new LocalPasswordIdentityService(prisma);
  });

  function activeIdentity() {
    return {
      userId,
      email: storedEmail,
      passwordHash: storedHash,
      emailConfirmedAt: new Date('2026-10-01T10:00:00.000Z'),
      disabledAt: null,
      profile: { fullName: 'Swim Coach' },
    };
  }

  it('authenticates a confirmed account and records successful sign-in', async () => {
    findUnique.mockResolvedValue(activeIdentity());
    expect(
      await service.signInWithPassword('  COACH@EXAMPLE.INVALID ', password),
    ).toEqual({
      id: userId,
      email: storedEmail,
      fullName: 'Swim Coach',
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { email: storedEmail },
      select: expect.objectContaining({
        passwordHash: true,
        emailConfirmedAt: true,
        disabledAt: true,
      }),
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        userId,
        passwordHash: storedHash,
        disabledAt: null,
        emailConfirmedAt: { not: null },
      },
      data: { lastSignInAt: expect.any(Date) },
    });
  });

  it('rejects unknown accounts with the same public error', async () => {
    findUnique.mockResolvedValue(null);
    await expect(
      service.signInWithPassword('missing@example.invalid', password),
    ).rejects.toThrow('Invalid login credentials');
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('rejects a wrong password without updating the identity', async () => {
    findUnique.mockResolvedValue(activeIdentity());
    await expect(
      service.signInWithPassword(storedEmail, 'another-invalid-password'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('rejects an identity without a password or verified email', async () => {
    for (const changes of [
      { passwordHash: null },
      { emailConfirmedAt: null },
      { profile: null },
    ]) {
      findUnique.mockResolvedValue({ ...activeIdentity(), ...changes });
      await expect(
        service.signInWithPassword(storedEmail, password),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('rejects disabled accounts even when their password is correct', async () => {
    findUnique.mockResolvedValue({
      ...activeIdentity(),
      disabledAt: new Date(),
    });
    await expect(
      service.signInWithPassword(storedEmail, password),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('rejects stale passwords or accounts disabled during verification', async () => {
    findUnique.mockResolvedValue(activeIdentity());
    updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.signInWithPassword(storedEmail, password),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('fails closed when stored credential hash is malformed', async () => {
    findUnique.mockResolvedValue({
      ...activeIdentity(),
      passwordHash: 'not-a-bcrypt-hash',
    });
    await expect(
      service.signInWithPassword(storedEmail, password),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('lists only enabled identities using a minimal non-sensitive column selection', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        userId,
        email: storedEmail,
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
        lastSignInAt: null,
        emailConfirmedAt: new Date('2026-10-01T00:00:00.000Z'),
      },
    ]);
    const service = new LocalPasswordIdentityService({
      localAuthIdentity: { findMany },
    } as unknown as PrismaService);

    await expect(service.listUsers()).resolves.toEqual([
      {
        id: userId,
        email: storedEmail,
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
        lastSignInAt: null,
        emailConfirmedAt: new Date('2026-10-01T00:00:00.000Z'),
      },
    ]);
    expect(findMany).toHaveBeenCalledWith({
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
    const query = JSON.stringify(findMany.mock.calls[0][0]);
    expect(query).not.toMatch(/passwordHash|tokenHash|actionTokens|refreshTokenHash/);
  });

  it('returns an empty directory when no local identity is present', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new LocalPasswordIdentityService({
      localAuthIdentity: { findMany },
    } as unknown as PrismaService);
    await expect(service.listUsers()).resolves.toEqual([]);
  });

  it('generates bcrypt hashes without retaining the plaintext password', async () => {
    const result = await service.hashPasswordForProvisioning(password);
    expect(result).not.toContain(password);
    expect(result).toMatch(/^\$2[aby]\$12\$/);
    expect(await compare(password, result)).toBe(true);
    expect(await compare('wrong-password', result)).toBe(false);
  });

  it('rejects passwords outside the 12 to 72 UTF-8 byte range', async () => {
    for (const value of ['short', 'x'.repeat(73), 'á'.repeat(37)]) {
      await expect(service.hashPasswordForProvisioning(value)).rejects.toThrow(
        'between 12 and 72',
      );
    }
  });
});
