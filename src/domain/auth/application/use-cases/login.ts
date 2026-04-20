import type { LoginRequest } from '../dtos/auth-session';
import { AuthSessionManager } from '../repositories/auth-session-manager';

export class LoginUseCase {
  constructor(private readonly authSessionManager: AuthSessionManager) {}

  async execute(input: LoginRequest) {
    return this.authSessionManager.login(input);
  }
}
