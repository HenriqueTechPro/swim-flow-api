import { AuthProfilesRepository } from '../repositories/auth-profiles-repository';

export class GetProfileUseCase {
  constructor(private readonly authProfilesRepository: AuthProfilesRepository) {}

  async execute(userId: string) {
    const profile = await this.authProfilesRepository.findByUserId(userId);

    return {
      profile,
    };
  }
}
