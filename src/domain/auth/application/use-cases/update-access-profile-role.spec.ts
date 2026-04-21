import { beforeEach, describe, expect, it } from '@jest/globals';
import { AppError } from '@/shared/errors/app-error';
import type {
  AuthProfile,
  AuthProfilesRepository,
} from '../repositories/auth-profiles-repository';
import { UpdateAccessProfileRoleUseCase } from './update-access-profile-role';

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

  async update(
    _userId: string,
    _input: { fullName?: string; avatarUrl?: string | null },
  ) {
    throw new Error('Method not implemented in this test');
  }
}

describe('UpdateAccessProfileRoleUseCase', () => {
  let authProfilesRepository: InMemoryAuthProfilesRepository;
  let sut: UpdateAccessProfileRoleUseCase;

  beforeEach(() => {
    authProfilesRepository = new InMemoryAuthProfilesRepository();
    sut = new UpdateAccessProfileRoleUseCase(authProfilesRepository);
  });

  it('prevents a user from changing their own role', async () => {
    await expect(
      sut.execute({
        actorUserId: 'admin-1',
        targetUserId: 'admin-1',
        role: 'teacher',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('prevents removing the last admin', async () => {
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
        role: 'teacher',
      }),
    ).rejects.toMatchObject({
      message: 'At least one admin must remain active',
    });
  });

  it('updates the role when another admin still remains active', async () => {
    authProfilesRepository.items.push(
      {
        id: 'admin-1',
        role: 'admin',
        permissions: ['auth:invite', 'auth:manage-users'],
        fullName: 'Admin User',
        avatarUrl: null,
      },
      {
        id: 'admin-2',
        role: 'admin',
        permissions: ['auth:invite', 'auth:manage-users'],
        fullName: 'Second Admin',
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

    const { profile } = await sut.execute({
      actorUserId: 'admin-1',
      targetUserId: 'admin-2',
      role: 'teacher',
    });

    expect(profile.role).toBe('teacher');
  });
});
