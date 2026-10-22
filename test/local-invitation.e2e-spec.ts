import { INestApplication, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { LocalAuthActionTokensService } from '../src/infra/auth/local-auth-action-tokens.service';
import { TrustedOriginGuard } from '../src/infra/auth/trusted-origin.guard';
import { createE2EApp, withDefaultTestOverrides } from './utils/create-e2e-app';

describe('Local invitation acceptance HTTP (e2e)', () => {
  let app: INestApplication<App>;
  let redeem: jest.Mock;

  beforeEach(async () => {
    redeem = jest.fn().mockResolvedValue({
      id: 'example-identity',
      email: 'coach@example.invalid',
      fullName: 'Coach',
    });
    app = await createE2EApp((builder) =>
      withDefaultTestOverrides(builder)
        .overrideProvider(LocalAuthActionTokensService)
        .useValue({ redeemWithPassword: redeem })
        .overrideGuard(TrustedOriginGuard)
        .useValue({ canActivate: () => true }),
    );
  });

  afterEach(async () => app.close());

  const body = {
    token: 'x'.repeat(43),
    password: 'a-secure-password-2026',
  };

  it('accepts an invitation with a POST body, never issuing a session or exposing tokens', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/local-invitations/accept')
      .send(body)
      .expect(201)
      .expect('Cache-Control', 'no-store');

    expect(response.body).toEqual({ data: { success: true } });
    expect(JSON.stringify(response.body)).not.toContain(body.token);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(redeem).toHaveBeenCalledWith(
      body.token,
      'INVITATION',
      body.password,
    );
  });

  it('rejects malformed/short/oversized passwords before the token service is invoked', async () => {
    for (const payload of [
      { ...body, token: 'bad-token' },
      { ...body, password: 'short' },
      { ...body, password: 'á'.repeat(40) },
      { ...body, password: body.password, unexpected: 'extra' },
    ]) {
      await request(app.getHttpServer())
        .post('/api/auth/local-invitations/accept')
        .send(payload)
        .expect(400);
    }
    expect(redeem).not.toHaveBeenCalled();
  });

  it('keeps expired/used tokens as generic authorization failures', async () => {
    redeem.mockRejectedValueOnce(
      new UnauthorizedException('Invalid or expired authentication action'),
    );
    const response = await request(app.getHttpServer())
      .post('/api/auth/local-invitations/accept')
      .send(body)
      .expect(401);
    expect(JSON.stringify(response.body)).not.toContain(body.token);
  });

  it('limits repeated accept attempts by source IP', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/auth/local-invitations/accept')
        .send(body)
        .expect(201);
    }
    await request(app.getHttpServer())
      .post('/api/auth/local-invitations/accept')
      .send(body)
      .expect(429);
  });
});
