import type { AuthRequestContext } from '../dtos/auth-session';
import { AuthSessionManager } from '../repositories/auth-session-manager';

export class RefreshSessionUseCase {
  constructor(private readonly authSessionManager: AuthSessionManager) {}

  async execute(refreshToken: string, context?: AuthRequestContext) {
    return this.authSessionManager.refresh(refreshToken, context);
  }
}
