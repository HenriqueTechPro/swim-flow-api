import { ServiceUnavailableException } from '@nestjs/common';
import { EnvService } from '@/infra/env/env.service';
import { LocalAuthDirectoryService } from './local-auth-directory.service';
import { LocalPasswordIdentityService } from './local-password-identity.service';

describe('LocalAuthDirectoryService', () => {
  const identity = {
    id: 'user-1',
    email: 'coach@example.invalid',
    fullName: 'Coach',
  };
  let identities: jest.Mocked<LocalPasswordIdentityService>;
  let envService: EnvService;

  beforeEach(() => {
    identities = {
      signInWithPassword: jest.fn().mockResolvedValue(identity),
      listUsers: jest.fn().mockResolvedValue([
        {
          id: 'user-1',
          email: 'coach@example.invalid',
          createdAt: new Date('2026-10-01T00:00:00.000Z'),
          lastSignInAt: null,
          emailConfirmedAt: null,
        },
      ]),
    } as unknown as jest.Mocked<LocalPasswordIdentityService>;

    envService = {
      localPasswordLoginEnabled: false,
    } as EnvService;
  });

  it('keeps login closed by default and never queries the database', async () => {
    const adapter = new LocalAuthDirectoryService(identities, envService);
    await expect(
      adapter.signInWithPassword('coach@example.invalid', 'secret'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(identities.signInWithPassword).not.toHaveBeenCalled();
  });

  it('delegates to verified local password identities when explicitly enabled', async () => {
    envService = { localPasswordLoginEnabled: true } as EnvService;
    const adapter = new LocalAuthDirectoryService(identities, envService);
    await expect(
      adapter.signInWithPassword(' COACH@EXAMPLE.INVALID ', 'secret'),
    ).resolves.toEqual(identity);
    expect(identities.signInWithPassword).toHaveBeenCalledWith(
      ' COACH@EXAMPLE.INVALID ',
      'secret',
    );
  });

  it('lists local identity metadata through the Neon adapter without legacy credentials', async () => {
    const adapter = new LocalAuthDirectoryService(identities, envService);
    await expect(adapter.listUsers()).resolves.toEqual([
      expect.objectContaining({ id: 'user-1', email: 'coach@example.invalid' }),
    ]);
    expect(identities.listUsers).toHaveBeenCalledTimes(1);
  });

  it('never accepts Supabase/Google access tokens through the legacy endpoint', async () => {
    envService = { localPasswordLoginEnabled: true } as EnvService;
    const adapter = new LocalAuthDirectoryService(identities, envService);

    await expect(
      adapter.getIdentityFromAccessToken('unverified-token'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('fails closed for unsupported legacy management and reset operations', async () => {
    envService = { localPasswordLoginEnabled: true } as EnvService;
    const adapter = new LocalAuthDirectoryService(identities, envService);

    await expect(
      adapter.sendPasswordResetEmail(
        'coach@example.invalid',
        'https://example.invalid/reset',
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(
      adapter.confirmPasswordReset({
        accessToken: 'a',
        refreshToken: 'b',
        password: 'c',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(
      adapter.inviteUserByEmail({
        email: 'coach@example.invalid',
        redirectTo: 'https://example.invalid',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(adapter.deleteUser('user-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
