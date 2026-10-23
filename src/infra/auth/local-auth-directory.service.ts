import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  AuthDirectoryRepository,
  type AuthDirectoryUser,
  type AuthIdentity,
  type DirectoryInvitation,
  type PasswordResetConfirmation,
} from '@/domain/auth/application/repositories/auth-directory-repository';
import { EnvService } from '@/infra/env/env.service';
import { LocalPasswordIdentityService } from './local-password-identity.service';

/**
 * Neon identity adapter. Login is the only legacy-contract method enabled
 * during the staged cutover; all other legacy methods fail closed.
 */
@Injectable()
export class LocalAuthDirectoryService extends AuthDirectoryRepository {
  constructor(
    private readonly identities: LocalPasswordIdentityService,
    private readonly envService: EnvService,
  ) {
    super();
  }

  async signInWithPassword(
    email: string,
    password: string,
  ): Promise<AuthIdentity> {
    if (!this.envService.localPasswordLoginEnabled) {
      throw new ServiceUnavailableException(
        'Local password login is not enabled',
      );
    }

    return this.identities.signInWithPassword(email, password);
  }

  async getIdentityFromAccessToken(
    _accessToken: string,
  ): Promise<AuthIdentity> {
    throw new ServiceUnavailableException('Google login is not configured');
  }

  async sendPasswordResetEmail(
    _email: string,
    _redirectTo: string,
  ): Promise<void> {
    throw new ServiceUnavailableException(
      'Legacy password reset is not configured',
    );
  }

  async confirmPasswordReset(
    _input: PasswordResetConfirmation,
  ): Promise<AuthIdentity> {
    throw new ServiceUnavailableException(
      'Legacy password reset is not configured',
    );
  }

  async inviteUserByEmail(
    _input: DirectoryInvitation,
  ): Promise<AuthIdentity> {
    throw new ServiceUnavailableException(
      'Legacy invitations are not configured',
    );
  }

  async listUsers(): Promise<AuthDirectoryUser[]> {
    throw new ServiceUnavailableException(
      'Legacy user directory is not configured',
    );
  }

  async deleteUser(_userId: string): Promise<void> {
    throw new ServiceUnavailableException(
      'Legacy user management is not configured',
    );
  }
}
