import { ListAccessProfilesUseCase } from './list-access-profiles';
import { AuthDirectoryRepository } from '../repositories/auth-directory-repository';
import { AuthProfilesRepository } from '../repositories/auth-profiles-repository';
import { getPermissionsForRole } from '@/infra/auth/role-permissions';

describe('ListAccessProfilesUseCase (local identity directory)', () => {
  const now = new Date('2026-10-27T09:00:00.000Z');
  const profiles = [
    { id: 'one', role: 'admin' as const, fullName: 'Zoe', avatarUrl: null,
      permissions: getPermissionsForRole('admin') },
    { id: 'two', role: 'teacher' as const, fullName: 'Ana', avatarUrl: null,
      permissions: getPermissionsForRole('teacher') },
    { id: 'orphan', role: 'user' as const, fullName: 'Orphan', avatarUrl: null,
      permissions: getPermissionsForRole('user') },
  ];
  const authProfilesRepository = {
    list: jest.fn().mockResolvedValue(profiles),
  } as unknown as AuthProfilesRepository;
  const authDirectoryRepository = {
    listUsers: jest.fn().mockResolvedValue([
      { id: 'one', email: 'zoe@example.invalid', createdAt: now,
        lastSignInAt: now, emailConfirmedAt: now },
      { id: 'two', email: 'ana@example.invalid', createdAt: now,
        lastSignInAt: null, emailConfirmedAt: null },
      { id: 'unlinked', email: 'unlinked@example.invalid', createdAt: now,
        lastSignInAt: now, emailConfirmedAt: now },
    ]),
  } as unknown as AuthDirectoryRepository;

  it('joins existing local identities with authorized profiles and preserves active/invited state', async () => {
    const sut = new ListAccessProfilesUseCase(authProfilesRepository, authDirectoryRepository);
    const { profiles: listed } = await sut.execute();
    expect(listed).toHaveLength(2);
    expect(listed.map((item) => item.id)).toEqual(['two', 'one']);
    expect(listed[0]).toMatchObject({ email: 'ana@example.invalid', lastSignInAt: null });
    expect(listed[1]).toMatchObject({ role: 'admin', lastSignInAt: now });
    expect(listed.find((item) => item.id === 'orphan')).toBeUndefined();
    expect(listed.find((item) => item.id === 'unlinked')).toBeUndefined();
  });

  it('propagates database failure instead of presenting an empty authorized directory', async () => {
    const directory = {
      listUsers: jest.fn().mockRejectedValue(new Error('database unavailable')),
    } as unknown as AuthDirectoryRepository;
    await expect(
      new ListAccessProfilesUseCase(authProfilesRepository, directory).execute(),
    ).rejects.toThrow('database unavailable');
  });
});
