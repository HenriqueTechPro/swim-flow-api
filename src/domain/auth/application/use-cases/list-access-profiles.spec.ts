import type { AuthDirectoryRepository } from '../repositories/auth-directory-repository';
import type { AuthProfilesRepository } from '../repositories/auth-profiles-repository';
import { ListAccessProfilesUseCase } from './list-access-profiles';

describe('ListAccessProfilesUseCase with local Neon identities', () => {
  const profiles = [
    {
      id: 'pending',
      fullName: 'Pending User',
      role: 'teacher' as const,
      permissions: [],
      avatarUrl: null,
    },
    {
      id: 'active',
      fullName: 'Active Admin',
      role: 'admin' as const,
      permissions: [],
      avatarUrl: null,
    },
    {
      id: 'legacy',
      fullName: 'No linked local identity',
      role: 'user' as const,
      permissions: [],
      avatarUrl: null,
    },
  ];
  const directoryUsers = [
    {
      id: 'active',
      email: 'active@example.invalid',
      createdAt: new Date('2026-10-01T08:00:00.000Z'),
      lastSignInAt: new Date('2026-10-22T08:00:00.000Z'),
      emailConfirmedAt: new Date('2026-10-01T08:00:00.000Z'),
    },
    {
      id: 'pending',
      email: 'pending@example.invalid',
      createdAt: new Date('2026-10-25T08:00:00.000Z'),
      lastSignInAt: null,
      emailConfirmedAt: null,
    },
  ];

  it('joins only local identities, keeping invited/active metadata without credentials', async () => {
    const listProfiles = jest.fn().mockResolvedValue(profiles);
    const listUsers = jest.fn().mockResolvedValue(directoryUsers);
    const sut = new ListAccessProfilesUseCase(
      { list: listProfiles } as unknown as AuthProfilesRepository,
      { listUsers } as unknown as AuthDirectoryRepository,
    );
    const { profiles: result } = await sut.execute();

    expect(result.map(({ id }) => id)).toEqual(['active', 'pending']);
    expect(result[0]).toMatchObject({
      email: 'active@example.invalid',
      role: 'admin',
      lastSignInAt: directoryUsers[0].lastSignInAt,
    });
    expect(result[1]).toMatchObject({
      email: 'pending@example.invalid',
      role: 'teacher',
      lastSignInAt: null,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /passwordHash|actionToken|refreshTokenHash/,
    );
    expect(listProfiles).toHaveBeenCalledTimes(1);
    expect(listUsers).toHaveBeenCalledTimes(1);
  });

  it('never fabricates access profiles when there are no local directory identities', async () => {
    const sut = new ListAccessProfilesUseCase(
      { list: async () => profiles } as unknown as AuthProfilesRepository,
      { listUsers: async () => [] } as unknown as AuthDirectoryRepository,
    );
    await expect(sut.execute()).resolves.toEqual({ profiles: [] });
  });
});
