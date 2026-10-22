import {
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '@/infra/database/prisma/prisma.service';
import { LocalAuthActionTokensService } from './local-auth-action-tokens.service';
import { PasswordResetMailSender } from './local-password-reset-mail-sender';
import { LocalPasswordResetService } from './local-password-reset.service';

describe('LocalPasswordResetService', () => {
  const email = 'swimmer@example.invalid';
  const userId = '11111111-1111-4111-8111-111111111111';
  const expiresAt = new Date('2026-10-22T12:00:00.000Z');

  let findUnique: jest.Mock;
  let issueForIdentity: jest.Mock;
  let sendReset: jest.Mock;
  let assertReady: jest.Mock;
  let service: LocalPasswordResetService;

  const eligible = () => ({
    userId,
    email,
    disabledAt: null,
    emailConfirmedAt: new Date('2026-10-01T00:00:00Z'),
    passwordHash: 'secure-bcrypt-hash',
  });

  beforeEach(() => {
    findUnique = jest.fn().mockResolvedValue(eligible());
    issueForIdentity = jest.fn().mockResolvedValue({
      token: 'x'.repeat(43),
      expiresAt,
    });
    sendReset = jest.fn().mockResolvedValue(undefined);
    assertReady = jest.fn();

    service = new LocalPasswordResetService(
      { localAuthIdentity: { findUnique } } as unknown as PrismaService,
      { issueForIdentity } as unknown as LocalAuthActionTokensService,
      { assertReady, sendReset } as unknown as PasswordResetMailSender,
    );
  });

  it('issues a reset only for a confirmed, active local identity', async () => {
    expect(await service.request('  SWIMMER@EXAMPLE.INVALID  ')).toEqual({
      success: true,
    });
    expect(assertReady).toHaveBeenCalledTimes(1);
    expect(findUnique).toHaveBeenCalledWith({
      where: { email },
      select: {
        userId: true,
        email: true,
        emailConfirmedAt: true,
        disabledAt: true,
        passwordHash: true,
      },
    });
    expect(issueForIdentity).toHaveBeenCalledWith(userId, 'PASSWORD_RESET');
    expect(sendReset).toHaveBeenCalledWith({
      to: email,
      token: 'x'.repeat(43),
      expiresAt,
    });
  });

  it('uses the same generic response for nonexistent, unverified or disabled identities', async () => {
    for (const record of [
      null,
      { ...eligible(), emailConfirmedAt: null },
      { ...eligible(), disabledAt: new Date() },
      { ...eligible(), passwordHash: null },
    ]) {
      findUnique.mockResolvedValueOnce(record);
      await expect(service.request(email)).resolves.toEqual({ success: true });
    }
    expect(issueForIdentity).not.toHaveBeenCalled();
    expect(sendReset).not.toHaveBeenCalled();
  });

  it('rejects invalid email shape without attempting database access', async () => {
    for (const invalid of [
      '',
      'not-an-email',
      'x'.repeat(321),
      '<a@example.invalid>',
    ]) {
      await expect(service.request(invalid)).resolves.toEqual({
        success: true,
      });
    }
    expect(findUnique).not.toHaveBeenCalled();
    expect(sendReset).not.toHaveBeenCalled();
  });

  it('fails closed for globally disabled delivery before looking up email', async () => {
    assertReady.mockImplementation(() => {
      throw new ServiceUnavailableException('disabled');
    });
    await expect(service.request(email)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(findUnique).not.toHaveBeenCalled();
    expect(issueForIdentity).not.toHaveBeenCalled();
  });

  it('keeps the public answer generic if the account changes or mail delivery fails', async () => {
    issueForIdentity.mockRejectedValueOnce(
      new UnprocessableEntityException('account no longer eligible'),
    );
    await expect(service.request(email)).resolves.toEqual({ success: true });
    expect(sendReset).not.toHaveBeenCalled();

    sendReset.mockRejectedValueOnce(
      new ServiceUnavailableException('provider failure'),
    );
    await expect(service.request(email)).resolves.toEqual({ success: true });
  });

  it('propagates unexpected database failures instead of pretending delivery succeeded', async () => {
    findUnique.mockRejectedValue(new Error('database unavailable'));
    await expect(service.request(email)).rejects.toThrow(
      'database unavailable',
    );
    expect(sendReset).not.toHaveBeenCalled();
  });
});
