import { ServiceUnavailableException } from '@nestjs/common';
import { ResendPasswordResetMailSender } from './local-password-reset-mail-sender';

describe('ResendPasswordResetMailSender', () => {
  const keys = [
    'SWIMFLOW_LOCAL_PASSWORD_RESET_ENABLED',
    'RESEND_API_KEY',
    'RESEND_FROM_EMAIL',
    'SWIMFLOW_AUTH_APP_ORIGIN',
  ] as const;
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  const sender = new ResendPasswordResetMailSender();
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    process.env.SWIMFLOW_LOCAL_PASSWORD_RESET_ENABLED = 'true';
    process.env.RESEND_API_KEY = 'not-a-real-key';
    process.env.RESEND_FROM_EMAIL = 'no-reply@example.invalid';
    process.env.SWIMFLOW_AUTH_APP_ORIGIN = 'https://swimflow.example.invalid';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });

  const sample = () => ({
    to: 'swimmer@example.invalid',
    token: 't'.repeat(43),
    expiresAt: new Date('2026-10-22T12:00:00Z'),
  });

  it('never contacts Resend when disabled or missing credentials', async () => {
    delete process.env.SWIMFLOW_LOCAL_PASSWORD_RESET_ENABLED;
    const mock = jest.fn();
    global.fetch = mock as typeof fetch;
    expect(() => sender.assertReady()).toThrow(ServiceUnavailableException);
    await expect(sender.sendReset(sample())).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(mock).not.toHaveBeenCalled();

    process.env.SWIMFLOW_LOCAL_PASSWORD_RESET_ENABLED = 'true';
    delete process.env.RESEND_API_KEY;
    expect(() => sender.assertReady()).toThrow(ServiceUnavailableException);
  });

  it('rejects non-HTTPS, credentialed or path-bearing origin values', () => {
    for (const origin of [
      'http://swimflow.example.invalid',
      'https://swimflow.example.invalid/path',
      'https://username:password@swimflow.example.invalid',
      'https://swimflow.example.invalid/#token=x',
    ]) {
      process.env.SWIMFLOW_AUTH_APP_ORIGIN = origin;
      expect(() => sender.assertReady()).toThrow(ServiceUnavailableException);
    }
  });

  it('sends a fixed reset link with token in URL fragment, not query', async () => {
    const mock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mock as typeof fetch;
    await sender.sendReset(sample());
    expect(mock).toHaveBeenCalledTimes(1);
    const [url, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    if (typeof init.body !== 'string') throw new Error('Missing email body');
    const body = JSON.parse(init.body) as { to: string[]; text: string };
    expect(body.to).toEqual(['swimmer@example.invalid']);
    expect(body.text).toContain('/auth/reset-local-password#token=');
    expect(body.text).toContain(sample().token);
    expect(body.text).not.toContain('?token=');
    expect(init.headers).toEqual(
      expect.objectContaining({
        Authorization: 'Bearer not-a-real-key',
      }),
    );
  });

  it('returns only a generic error for provider failures', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'SECRET_REMOTE_BODY',
    }) as typeof fetch;
    await expect(sender.sendReset(sample())).rejects.toThrow(
      'Password reset delivery failed',
    );
  });
});
