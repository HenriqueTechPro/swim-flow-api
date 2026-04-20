import type { AccessTokenLoginRequest } from '../dtos/auth-session';
import { AuthSessionManager } from '../repositories/auth-session-manager';

export class LoginWithGoogleUseCase {
  constructor(private readonly authSessionManager: AuthSessionManager) {}

  async execute(input: AccessTokenLoginRequest) {
    return this.authSessionManager.loginWithAccessToken(input);
  }
}
