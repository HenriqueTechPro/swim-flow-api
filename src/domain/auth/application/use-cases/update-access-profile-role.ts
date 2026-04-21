import { AppError } from '@/shared/errors/app-error';
import type { AppRole } from '../auth.types';
import { AuthProfilesRepository } from '../repositories/auth-profiles-repository';

export class UpdateAccessProfileRoleUseCase {
  constructor(private readonly authProfilesRepository: AuthProfilesRepository) {}

  async execute(input: {
    actorUserId: string;
    targetUserId: string;
    role: AppRole;
  }) {
    if (input.actorUserId === input.targetUserId) {
      throw new AppError(400, 'You cannot change your own access role');
    }

    const currentProfile = await this.authProfilesRepository.findByUserId(
      input.targetUserId,
    );

    if (!currentProfile) {
      throw new AppError(404, 'Profile not found');
    }

    if (currentProfile.role === input.role) {
      return {
        profile: currentProfile,
      };
    }

    if (currentProfile.role === 'admin' && input.role !== 'admin') {
      const adminCount = await this.authProfilesRepository.countByRole('admin');

      if (adminCount <= 1) {
        throw new AppError(409, 'At least one admin must remain active');
      }
    }

    const profile = await this.authProfilesRepository.updateRole(
      input.targetUserId,
      input.role,
    );

    return {
      profile,
    };
  }
}
