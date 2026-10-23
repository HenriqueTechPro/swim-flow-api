import { PrismaService } from '../prisma.service';
import { PrismaAuthSessionsRepository } from './prisma-auth-sessions-repository';

describe('PrismaAuthSessionsRepository: local identity gates', () => {
  let findFirst: jest.Mock;
  let repository: PrismaAuthSessionsRepository;

  beforeEach(() => {
    findFirst = jest.fn().mockResolvedValue(null);
    const prisma = {
      authSession: { findFirst },
    } as unknown as PrismaService;
    repository = new PrismaAuthSessionsRepository(prisma);
  });

  const activeIdentity = {
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

  it('rejects an access-token session when the user is not verified and active', async () => {
    await expect(repository.findActiveById('session-1')).resolves.toBeNull();
    expect(findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'session-1',
        revokedAt: null,
        ...activeIdentity,
      }),
    });
  });

  it('applies the same active-identity restriction before refresh rotation', async () => {
    await expect(
      repository.findByRefreshTokenHash('refresh-hash'),
    ).resolves.toBeNull();
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        refreshTokenHash: 'refresh-hash',
        ...activeIdentity,
      },
    });
  });

  it('restricts active refresh-session queries to verified local users', async () => {
    await expect(
      repository.findActiveByRefreshTokenHash('refresh-hash'),
    ).resolves.toBeNull();
    expect(findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        refreshTokenHash: 'refresh-hash',
        revokedAt: null,
        ...activeIdentity,
      }),
    });
  });
});
