import { AuthSessionManager } from '../repositories/auth-session-manager';

export class LogoutUseCase {
  constructor(private readonly authSessionManager: AuthSessionManager) {}

  async execute(refreshToken?: string | null) {
    await this.authSessionManager.logout(refreshToken);

    return {
      success: true,
    };
  }
}
