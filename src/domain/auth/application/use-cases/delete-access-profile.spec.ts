import { beforeEach, describe, expect, it } from '@jest/globals';
import { AppError } from '@/shared/errors/app-error';
import type { AuthDirectoryRepository } from '../repositories/auth-directory-repository';
import type {
  AuthProfile,
  AuthProfilesRepository,
} from '../repositories/auth-profiles-repository';
import type { AuthSessionsRepository } from '../repositories/auth-sessions-repository';
import { DeleteAccessProfileUseCase } from './delete-access-profile';

class InMemoryAuthProfilesRepository implements AuthProfilesRepository {
  items: AuthProfile[] = [];

  async getOrCreate(_: {
    userId: string;
    email: string;
    fullName?: string | null;
    role?: AuthProfile['role'];
  }) {
    throw new Error('Method not implemented in this test');
  }

  async findByUserId(userId: string) {
    return this.items.find((item) => item.id === userId) ?? null;
  }

  async list() {
    return this.items;
  }

  async countByRole(role: AuthProfile['role']) {
    return this.items.filter((item) => item.role === role).length;
  }

  async updateRole(userId: string, role: AuthProfile['role']) {
    const profile = await this.findByUserId(userId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    profile.role = role;
    return profile;
  }

  async deleteByUserId(userId: string) {
    this.items = this.items.filter((item) => item.id !== userId);
  }

  async update(
    _userId: string,
    _input: { fullName?: string; avatarUrl?: string | null },
  ) {
    throw new Error('Method not implemented in this test');
  }
}

describe('DeleteAccessProfileUseCase', () => {
  let authProfilesRepository: InMemoryAuthProfilesRepository;
  let authDirectoryRepository: jest.Mocked<AuthDirectoryRepository>;
  let authSessionsRepository: jest.Mocked<AuthSessionsRepository>;
  let sut: DeleteAccessProfileUseCase;

  beforeEach(() => {
    authProfilesRepository = new InMemoryAuthProfilesRepository();
    authDirectoryRepository = {
      listUsers: jest.fn(),
      deleteUser: jest.fn(),
    } as unknown as jest.Mocked<AuthDirectoryRepository>;
    authSessionsRepository = {
      create: jest.fn(),
      findActiveById: jest.fn(),
      findByRefreshTokenHash: jest.fn(),
      findActiveByRefreshTokenHash: jest.fn(),
      revoke: jest.fn(),
      revokeAllForUser: jest.fn(),
    } as jest.Mocked<AuthSessionsRepository>;
    sut = new DeleteAccessProfileUseCase(
      authProfilesRepository,
      authDirectoryRepository,
      authSessionsRepository,
    );
  });

  it('prevents deleting your own access profile', async () => {
    await expect(
      sut.execute({
        actorUserId: 'admin-1',
        targetUserId: 'admin-1',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('prevents deleting the last admin', async () => {
    authProfilesRepository.items.push({
      id: 'admin-1',
      role: 'admin',
      permissions: ['auth:invite', 'auth:manage-users'],
      fullName: 'Admin User',
      avatarUrl: null,
    });

    await expect(
      sut.execute({
        actorUserId: 'admin-2',
        targetUserId: 'admin-1',
      }),
    ).rejects.toMatchObject({
      message: 'At least one admin must remain active',
    });
  });

  it('deletes the auth user, revokes sessions and removes the local profile', async () => {
    authProfilesRepository.items.push(
      {
        id: 'admin-1',
        role: 'admin',
        permissions: ['auth:invite', 'auth:manage-users'],
        fullName: 'Admin User',
        avatarUrl: null,
      },
      {
        id: 'teacher-1',
        role: 'teacher',
        permissions: ['teachers:read'],
        fullName: 'Teacher User',
        avatarUrl: null,
      },
    );

    const result = await sut.execute({
      actorUserId: 'admin-1',
      targetUserId: 'teacher-1',
    });

    expect(result).toEqual({ success: true });
    expect(authDirectoryRepository.deleteUser).toHaveBeenCalledWith('teacher-1');
    expect(authSessionsRepository.revokeAllForUser).toHaveBeenCalledWith(
      'teacher-1',
    );
    expect(authProfilesRepository.items).toHaveLength(1);
    expect(authProfilesRepository.items[0].id).toBe('admin-1');
  });
});
