import { AppError } from '@/shared/errors/app-error';
import { AuthDirectoryRepository } from '../repositories/auth-directory-repository';
import { AuthProfilesRepository } from '../repositories/auth-profiles-repository';
import { AuthSessionsRepository } from '../repositories/auth-sessions-repository';

export class DeleteAccessProfileUseCase {
  constructor(
    private readonly authProfilesRepository: AuthProfilesRepository,
    private readonly authDirectoryRepository: AuthDirectoryRepository,
    private readonly authSessionsRepository: AuthSessionsRepository,
  ) {}

  async execute(input: { actorUserId: string; targetUserId: string }) {
    if (input.actorUserId === input.targetUserId) {
      throw new AppError(400, 'You cannot delete your own access profile');
    }

    const profile = await this.authProfilesRepository.findByUserId(
      input.targetUserId,
    );

    if (!profile) {
      throw new AppError(404, 'Profile not found');
    }

    if (profile.role === 'admin') {
      const adminCount = await this.authProfilesRepository.countByRole('admin');

      if (adminCount <= 1) {
        throw new AppError(409, 'At least one admin must remain active');
      }
    }

    await this.authDirectoryRepository.deleteUser(input.targetUserId);
    await this.authSessionsRepository.revokeAllForUser(input.targetUserId);
    await this.authProfilesRepository.deleteByUserId(input.targetUserId);

    return {
      success: true,
    };
  }
}
