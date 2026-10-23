import { ServiceUnavailableException } from '@nestjs/common';
import { EnvService } from '@/infra/env/env.service';
import { SupabaseAuthService } from './supabase-auth.service';

describe('SupabaseAuthService without legacy credentials', () => {
  const env = {
    supabaseUrl: undefined,
    supabasePublishableKey: undefined,
    supabaseServiceRoleKey: null,
    corsOrigins: ['https://dashboard.example.com'],
  } as unknown as EnvService;
  const sut = new SupabaseAuthService(env);

  it('rejects password login without exposing credentials', async () => {
    await expect(
      sut.signInWithPassword('user@example.com', 'password'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects OAuth token exchange', async () => {
    await expect(
      sut.getIdentityFromAccessToken('some-token'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects password reset request and confirmation', async () => {
    await expect(
      sut.sendPasswordResetEmail(
        'user@example.com',
        'https://dashboard.example.com/reset-password',
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(
      sut.confirmPasswordReset({
        accessToken: 'test-access',
        refreshToken: 'test-refresh',
        password: 'new-password',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects legacy invitation and user administration', async () => {
    await expect(
      sut.inviteUserByEmail({
        email: 'user@example.com',
        redirectTo: 'https://dashboard.example.com/invitation',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(sut.listUsers()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(sut.deleteUser('user-id')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
