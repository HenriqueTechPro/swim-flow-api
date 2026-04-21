import type { AuthAccessProfile } from '../repositories/auth-profiles-repository';
import { AuthDirectoryRepository } from '../repositories/auth-directory-repository';
import { AuthProfilesRepository } from '../repositories/auth-profiles-repository';

export class ListAccessProfilesUseCase {
  constructor(
    private readonly authProfilesRepository: AuthProfilesRepository,
    private readonly authDirectoryRepository: AuthDirectoryRepository,
  ) {}

  async execute() {
    const [profiles, users] = await Promise.all([
      this.authProfilesRepository.list(),
      this.authDirectoryRepository.listUsers(),
    ]);

    const usersById = new Map(users.map((user) => [user.id, user]));

    const accessProfiles = profiles
      .flatMap<AuthAccessProfile>((profile) => {
        const user = usersById.get(profile.id);
        if (!user?.email) {
          return [];
        }

        return [
          {
            ...profile,
            email: user.email,
            createdAt: user.createdAt,
            lastSignInAt: user.lastSignInAt,
            emailConfirmedAt: user.emailConfirmedAt,
          },
        ];
      })
      .sort((left, right) => {
        const leftLabel = left.fullName.trim() || left.email;
        const rightLabel = right.fullName.trim() || right.email;
        return leftLabel.localeCompare(rightLabel, 'pt-BR', {
          sensitivity: 'base',
        });
      });

    return {
      profiles: accessProfiles,
    };
  }
}
