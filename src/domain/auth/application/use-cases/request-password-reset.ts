import type { RequestPasswordResetRequest } from '../dtos/auth-session';
import { AuthSessionManager } from '../repositories/auth-session-manager';

export class RequestPasswordResetUseCase {
  constructor(private readonly authSessionManager: AuthSessionManager) {}

  async execute(input: RequestPasswordResetRequest) {
    await this.authSessionManager.requestPasswordReset(input);

    return {
      success: true,
    };
  }
}
