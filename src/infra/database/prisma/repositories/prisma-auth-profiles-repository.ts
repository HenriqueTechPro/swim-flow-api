import { Injectable } from '@nestjs/common';
import { AuthProfilesRepository } from '@/domain/auth/application/repositories/auth-profiles-repository';
import type {
  AuthProfile,
  AuthenticatedProfile,
} from '@/domain/auth/application/repositories/auth-profiles-repository';
import type { AppRole } from '@/domain/auth/application/auth.types';
import type { UpdateProfileRequest } from '@/domain/auth/application/dtos/profile-requests';
import { getPermissionsForRole } from '@/infra/auth/role-permissions';
import { PrismaService } from '../prisma.service';

const authProfileSelect = {
  id: true,
  fullName: true,
  avatarUrl: true,
  role: true,
} as const;

type PrismaAuthProfileRecord = {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  role: 'admin' | 'teacher' | 'user';
};

function toAuthProfile(profile: PrismaAuthProfileRecord): AuthProfile {
  return {
    id: profile.id,
    role: profile.role,
    permissions: getPermissionsForRole(profile.role),
    fullName: profile.fullName,
    avatarUrl: profile.avatarUrl,
  };
}

@Injectable()
export class PrismaAuthProfilesRepository implements AuthProfilesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(input: {
    userId: string;
    email: string;
    fullName?: string | null;
    role?: AppRole;
  }): Promise<AuthenticatedProfile> {
    const profile = (await this.prisma.profile.upsert({
      where: { id: input.userId },
      create: {
        id: input.userId,
        fullName: input.fullName?.trim() || '',
        ...(input.role ? { role: input.role } : {}),
      },
      update: {
        ...(input.fullName && input.fullName.trim().length > 0
          ? { fullName: input.fullName.trim() }
          : {}),
        ...(input.role ? { role: input.role } : {}),
      },
      select: authProfileSelect,
    })) as PrismaAuthProfileRecord;

    return {
      ...toAuthProfile(profile),
      email: input.email,
    };
  }

  async findByUserId(userId: string): Promise<AuthProfile | null> {
    const profile = (await this.prisma.profile.findUnique({
      where: { id: userId },
      select: authProfileSelect,
    })) as PrismaAuthProfileRecord | null;

    return profile ? toAuthProfile(profile) : null;
  }

  async list(): Promise<AuthProfile[]> {
    const profiles = (await this.prisma.profile.findMany({
      select: authProfileSelect,
      orderBy: [{ fullName: 'asc' }, { createdAt: 'asc' }],
    })) as PrismaAuthProfileRecord[];

    return profiles.map(toAuthProfile);
  }

  async countByRole(role: AppRole): Promise<number> {
    return this.prisma.profile.count({
      where: { role },
    });
  }

  async updateRole(userId: string, role: AppRole): Promise<AuthProfile> {
    const profile = (await this.prisma.profile.update({
      where: { id: userId },
      data: {
        role,
        updatedAt: new Date(),
      },
      select: authProfileSelect,
    })) as PrismaAuthProfileRecord;

    return toAuthProfile(profile);
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.prisma.profile.deleteMany({
      where: { id: userId },
    });
  }

  async update(userId: string, input: UpdateProfileRequest): Promise<AuthProfile> {
    const profile = (await this.prisma.profile.upsert({
      where: { id: userId },
      create: {
        id: userId,
        fullName: input.fullName?.trim() ?? '',
        avatarUrl: input.avatarUrl ?? null,
      },
      update: {
        ...(input.fullName !== undefined
          ? { fullName: input.fullName.trim() }
          : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
        updatedAt: new Date(),
      },
      select: authProfileSelect,
    })) as PrismaAuthProfileRecord;

    return toAuthProfile(profile);
  }
}
