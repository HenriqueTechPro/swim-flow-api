import type { ConfirmPasswordResetRequest } from '../dtos/auth-session';
import { AuthSessionManager } from '../repositories/auth-session-manager';

export class ConfirmPasswordResetUseCase {
  constructor(private readonly authSessionManager: AuthSessionManager) {}

  async execute(input: ConfirmPasswordResetRequest) {
    return this.authSessionManager.confirmPasswordReset(input);
  }
}
