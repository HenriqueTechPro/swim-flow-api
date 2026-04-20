import type { UpdateProfileRequest } from '../dtos/profile-requests';
import { AuthProfilesRepository } from '../repositories/auth-profiles-repository';

export class UpdateProfileUseCase {
  constructor(private readonly authProfilesRepository: AuthProfilesRepository) {}

  async execute(userId: string, input: UpdateProfileRequest) {
    const profile = await this.authProfilesRepository.update(userId, input);

    return {
      profile,
    };
  }
}
