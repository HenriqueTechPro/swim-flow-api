import type { InviteUserRequest } from '../dtos/auth-session';
import { AuthSessionManager } from '../repositories/auth-session-manager';

export class InviteUserUseCase {
  constructor(private readonly authSessionManager: AuthSessionManager) {}

  async execute(input: InviteUserRequest) {
    await this.authSessionManager.inviteUser(input);

    return {
      success: true,
    };
  }
}
