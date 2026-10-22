import { INestApplication, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { LocalAuthActionTokensService } from '../src/infra/auth/local-auth-action-tokens.service';
import { LocalPasswordResetService } from '../src/infra/auth/local-password-reset.service';
import { createE2EApp, withDefaultTestOverrides } from './utils/create-e2e-app';

describe('Staged local password reset HTTP (e2e)', () => {
  let app: INestApplication<App>;
  let issue: jest.Mock;
  let redeem: jest.Mock;
  const keys = [
    'SWIMFLOW_LOCAL_PASSWORD_RESET_API_ENABLED',
    'SWIMFLOW_LOCAL_PASSWORD_RESET_ENABLED',
  ] as const;
  const previous = keys.map((key) => process.env[key]);
  const origin = 'http://localhost:8080';
  const requestPath = '/api/auth/local-password-reset/request';
  const confirmPath = '/api/auth/local-password-reset/confirm';
  const requestBody = { email: 'Coach@Example.invalid' };
  const confirmBody = {
    token: 'x'.repeat(43),
    password: 'a-strong-password-2026',
  };
  const enable = () => {
    process.env.SWIMFLOW_LOCAL_PASSWORD_RESET_API_ENABLED = 'true';
    process.env.SWIMFLOW_LOCAL_PASSWORD_RESET_ENABLED = 'true';
  };

  beforeEach(async () => {
    for (const key of keys) delete process.env[key];
    issue = jest.fn().mockResolvedValue({ success: true });
    redeem = jest.fn().mockResolvedValue({
      id: 'example-user',
      email: 'coach@example.invalid',
      fullName: 'Coach',
    });
    app = await createE2EApp((builder) =>
      withDefaultTestOverrides(builder)
        .overrideProvider(LocalPasswordResetService)
        .useValue({ request: issue })
        .overrideProvider(LocalAuthActionTokensService)
        .useValue({ redeemWithPassword: redeem }),
    );
  });

  afterEach(async () => {
    await app.close();
    for (let i = 0; i < keys.length; i += 1) {
      const value = previous[i];
      if (value === undefined) delete process.env[keys[i]];
      else process.env[keys[i]] = value;
    }
  });

  it('fails closed unless both flags are explicitly enabled', async () => {
    await request(app.getHttpServer())
      .post(requestPath)
      .set('Origin', origin)
      .send(requestBody)
      .expect(503);
    process.env.SWIMFLOW_LOCAL_PASSWORD_RESET_API_ENABLED = 'true';
    await request(app.getHttpServer())
      .post(confirmPath)
      .set('Origin', origin)
      .send(confirmBody)
      .expect(503);
    delete process.env.SWIMFLOW_LOCAL_PASSWORD_RESET_API_ENABLED;
    process.env.SWIMFLOW_LOCAL_PASSWORD_RESET_ENABLED = 'true';
    await request(app.getHttpServer())
      .post(requestPath)
      .set('Origin', origin)
      .send(requestBody)
      .expect(503);
    expect(issue).not.toHaveBeenCalled();
    expect(redeem).not.toHaveBeenCalled();
  });

  it('rejects untrusted, absent and forged Origins before lookup', async () => {
    enable();
    await request(app.getHttpServer())
      .post(requestPath)
      .send(requestBody)
      .expect(403);
    await request(app.getHttpServer())
      .post(requestPath)
      .set('Origin', 'https://attacker.example.invalid')
      .send(requestBody)
      .expect(403);
    await request(app.getHttpServer())
      .post(confirmPath)
      .set('Origin', 'http://localhost:8080/path')
      .send(confirmBody)
      .expect(403);
    expect(issue).not.toHaveBeenCalled();
    expect(redeem).not.toHaveBeenCalled();
  });

  it('returns only generic success with no secret/cookie for requests', async () => {
    enable();
    const response = await request(app.getHttpServer())
      .post(requestPath)
      .set('Origin', origin)
      .send(requestBody)
      .expect(201)
      .expect('Cache-Control', 'no-store');
    expect(response.body).toEqual({ data: { success: true } });
    expect(issue).toHaveBeenCalledWith(requestBody.email);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain(requestBody.email);
  });

  it('rejects redirects, extra fields and malformed email', async () => {
    enable();
    for (const body of [
      { ...requestBody, redirectTo: 'https://attacker.example.invalid' },
      { ...requestBody, extra: 'no' },
      { email: 'not-an-email' },
    ]) {
      await request(app.getHttpServer())
        .post(requestPath)
        .set('Origin', origin)
        .send(body)
        .expect(400);
    }
    expect(issue).not.toHaveBeenCalled();
  });

  it('confirms token in body without creating an authenticated session', async () => {
    enable();
    const response = await request(app.getHttpServer())
      .post(confirmPath)
      .set('Origin', origin)
      .send(confirmBody)
      .expect(201)
      .expect('Cache-Control', 'no-store');
    expect(redeem).toHaveBeenCalledWith(
      confirmBody.token,
      'PASSWORD_RESET',
      confirmBody.password,
    );
    expect(response.body).toEqual({ data: { success: true } });
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain(confirmBody.token);
  });

  it('returns a generic authorization failure for expired/used tokens', async () => {
    enable();
    redeem.mockRejectedValueOnce(
      new UnauthorizedException('Invalid or expired authentication action'),
    );
    const response = await request(app.getHttpServer())
      .post(confirmPath)
      .set('Origin', origin)
      .send(confirmBody)
      .expect(401);
    expect(JSON.stringify(response.body)).not.toContain(confirmBody.token);
  });

  it('rejects weak passwords, excess UTF-8 bytes and invalid tokens', async () => {
    enable();
    for (const body of [
      { ...confirmBody, token: 'short' },
      { ...confirmBody, password: 'short' },
      { ...confirmBody, password: 'á'.repeat(40) },
      { ...confirmBody, extra: 'no' },
    ]) {
      await request(app.getHttpServer())
        .post(confirmPath)
        .set('Origin', origin)
        .send(body)
        .expect(400);
    }
    expect(redeem).not.toHaveBeenCalled();
  });

  it('rate-limits issuance per IP even with rotating email addresses', async () => {
    enable();
    for (let i = 0; i < 3; i += 1) {
      await request(app.getHttpServer())
        .post(requestPath)
        .set('Origin', origin)
        .send({ email: `user${i}@example.invalid` })
        .expect(201);
    }
    await request(app.getHttpServer())
      .post(requestPath)
      .set('Origin', origin)
      .send({ email: 'another@example.invalid' })
      .expect(429);
    expect(issue).toHaveBeenCalledTimes(3);
  });

  it('rate-limits confirmation to five attempts per IP', async () => {
    enable();
    for (let i = 0; i < 5; i += 1) {
      await request(app.getHttpServer())
        .post(confirmPath)
        .set('Origin', origin)
        .send(confirmBody)
        .expect(201);
    }
    await request(app.getHttpServer())
      .post(confirmPath)
      .set('Origin', origin)
      .send(confirmBody)
      .expect(429);
    expect(redeem).toHaveBeenCalledTimes(5);
  });
});
