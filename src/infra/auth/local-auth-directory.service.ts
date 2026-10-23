import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  AuthDirectoryRepository,
  type AuthDirectoryUser,
  type AuthIdentity,
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

  signInWithPassword(email: string, password: string): Promise<AuthIdentity> {
    if (!this.envService.localPasswordLoginEnabled) {
      return Promise.reject(
        new ServiceUnavailableException('Local password login is not enabled'),
      );
    }

    return this.identities.signInWithPassword(email, password);
  }

  getIdentityFromAccessToken(): Promise<AuthIdentity> {
    return Promise.reject(
      new ServiceUnavailableException('Google login is not configured'),
    );
  }

  sendPasswordResetEmail(): Promise<void> {
    return Promise.reject(
      new ServiceUnavailableException(
        'Legacy password reset is not configured',
      ),
    );
  }

  confirmPasswordReset(): Promise<AuthIdentity> {
    return Promise.reject(
      new ServiceUnavailableException(
        'Legacy password reset is not configured',
      ),
    );
  }

  inviteUserByEmail(): Promise<AuthIdentity> {
    return Promise.reject(
      new ServiceUnavailableException('Legacy invitations are not configured'),
    );
  }

  listUsers(): Promise<AuthDirectoryUser[]> {
    return Promise.reject(
      new ServiceUnavailableException(
        'Legacy user directory is not configured',
      ),
    );
  }

  deleteUser(): Promise<void> {
    return Promise.reject(
      new ServiceUnavailableException(
        'Legacy user management is not configured',
      ),
    );
  }
}
