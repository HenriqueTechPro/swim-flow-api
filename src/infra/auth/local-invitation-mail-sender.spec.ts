import { ServiceUnavailableException } from '@nestjs/common';
import { ResendInvitationMailSender } from './local-invitation-mail-sender';

describe('ResendInvitationMailSender', () => {
  const keys = [
    'SWIMFLOW_LOCAL_INVITES_ENABLED',
    'RESEND_API_KEY',
    'RESEND_FROM_EMAIL',
    'SWIMFLOW_AUTH_APP_ORIGIN',
  ] as const;
  const before = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const sender = new ResendInvitationMailSender();
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    process.env.SWIMFLOW_LOCAL_INVITES_ENABLED = 'true';
    process.env.RESEND_API_KEY = 'test-only-not-a-real-key';
    process.env.RESEND_FROM_EMAIL = 'no-reply@example.invalid';
    process.env.SWIMFLOW_AUTH_APP_ORIGIN = 'https://swimflow.example.invalid';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    for (const key of keys) {
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
    }
  });

  it('is disabled by default and sends nothing', async () => {
    delete process.env.SWIMFLOW_LOCAL_INVITES_ENABLED;
    const mockFetch = jest.fn();
    global.fetch = mockFetch as typeof fetch;
    expect(() => sender.assertReady()).toThrow(ServiceUnavailableException);
    await expect(
      sender.sendInvitation({
        to: 'student@example.invalid',
        token: 'x'.repeat(43),
        expiresAt: new Date(),
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects untrusted origins and missing credentials', () => {
    for (const origin of [
      'http://swimflow.example.invalid',
      'https://swimflow.example.invalid/redirect',
      'https://swimflow.example.invalid#fragment',
      '***swimflow.example.invalid',
    ]) {
      process.env.SWIMFLOW_AUTH_APP_ORIGIN = origin;
      expect(() => sender.assertReady()).toThrow(ServiceUnavailableException);
    }
    process.env.SWIMFLOW_AUTH_APP_ORIGIN = 'https://swimflow.example.invalid';
    delete process.env.RESEND_API_KEY;
    expect(() => sender.assertReady()).toThrow(ServiceUnavailableException);
  });

  it('posts a fixed URL to Resend without exposing token in query parameters', async () => {
    const fakeFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fakeFetch as typeof fetch;
    const token = 'a'.repeat(43);
    await sender.sendInvitation({
      to: 'student@example.invalid',
      token,
      expiresAt: new Date('2026-10-22T09:00:00Z'),
    });
    expect(fakeFetch).toHaveBeenCalledTimes(1);
    const [endpoint, init] = fakeFetch.mock.calls[0] as [string, RequestInit];
    expect(endpoint).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    if (typeof init.body !== 'string') {
      throw new Error('Expected a JSON request body');
    }
    const payload = JSON.parse(init.body) as {
      from: string;
      to: string[];
      text: string;
    };
    expect(payload.from).toBe('no-reply@example.invalid');
    expect(payload.to).toEqual(['student@example.invalid']);
    expect(payload.text).toContain('/auth/accept-local-invitation#token=');
    expect(payload.text).toContain(token);
    expect(payload.text).not.toContain('?token=');
    expect(init.headers).toEqual(
      expect.objectContaining({
        Authorization: '***',
      }),
    );
  });

  it('hides remote provider errors and does not return the response body', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as typeof fetch;
    await expect(
      sender.sendInvitation({
        to: 'student@example.invalid',
        token: 'a'.repeat(43),
        expiresAt: new Date(),
      }),
    ).rejects.toThrow('Invitation delivery failed');
  });
});
