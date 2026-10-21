import { INestApplication, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AuthProfilesRepository } from '@/domain/auth/application/repositories/auth-profiles-repository';
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard';
import { LocalAdminInvitationsService } from '@/infra/auth/local-admin-invitations.service';
import { getPermissionsForRole } from '@/infra/auth/role-permissions';
import { createE2EApp, withDefaultTestOverrides } from './utils/create-e2e-app';

describe('Staged local administrator invitation HTTP gate (e2e)', () => {
  let app: INestApplication<App>;
  let invite: jest.Mock;
  const flagKeys = [
    'SWIMFLOW_LOCAL_INVITATION_API_ENABLED',
    'SWIMFLOW_LOCAL_INVITES_ENABLED',
  ] as const;
  const originalFlags = flagKeys.map((key) => process.env[key]);

  beforeEach(async () => {
    for (const key of flagKeys) delete process.env[key];
    invite = jest.fn().mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000001',
      email: 'athlete@example.invalid',
    });

    app = await createE2EApp((builder) =>
      withDefaultTestOverrides(builder)
        .overrideProvider(LocalAdminInvitationsService)
        .useValue({ invite })
        .overrideProvider(AuthProfilesRepository)
        .useValue({
          findByUserId: jest.fn(async (id: string) => ({
            id,
            fullName: 'CI Actor',
            avatarUrl: null,
            role: id === 'ci-admin' ? 'admin' : 'teacher',
            permissions: getPermissionsForRole(
              id === 'ci-admin' ? 'admin' : 'teacher',
            ),
          })),
        })
        .overrideGuard(JwtAuthGuard)
        .useValue({
          canActivate(context: ExecutionContext) {
            const req = context.switchToHttp().getRequest<{
              headers: { authorization?: string };
              user?: { id: string; email: string; sessionId: string };
            }>();
            const token = req.headers.authorization;
            if (token !== 'Bearer admin' && token !== 'Bearer teacher') {
              throw new UnauthorizedException('Missing access token');
            }
            req.user = {
              id: token === 'Bearer admin' ? 'ci-admin' : 'ci-teacher',
              email: 'ci-actor@example.invalid',
              sessionId: 'ci-session',
            };
            return true;
          },
        }),
    );
  });

  afterEach(async () => {
    await app.close();
    for (let i = 0; i < flagKeys.length; i += 1) {
      const value = originalFlags[i];
      if (value === undefined) delete process.env[flagKeys[i]];
      else process.env[flagKeys[i]] = value;
    }
  });

  const url = '/api/auth/local-invitations';
  const payload = {
    email: 'Athlete@EXAMPLE.invalid',
    fullName: 'CI Swimmer',
    role: 'teacher',
  };

  it('fails closed by default, without sending mail or creating accounts', async () => {
    await request(app.getHttpServer())
      .post(url)
      .set('Authorization', 'Bearer admin')
      .send(payload)
      .expect(503);

    process.env.SWIMFLOW_LOCAL_INVITATION_API_ENABLED = 'true';
    await request(app.getHttpServer())
      .post(url)
      .set('Authorization', 'Bearer admin')
      .send(payload)
      .expect(503);

    delete process.env.SWIMFLOW_LOCAL_INVITATION_API_ENABLED;
    process.env.SWIMFLOW_LOCAL_INVITES_ENABLED = 'true';
    await request(app.getHttpServer())
      .post(url)
      .set('Authorization', 'Bearer admin')
      .send(payload)
      .expect(503);
    expect(invite).not.toHaveBeenCalled();
  });

  it('rejects anonymous and non-administrator requests with both flags on', async () => {
    process.env.SWIMFLOW_LOCAL_INVITATION_API_ENABLED = 'true';
    process.env.SWIMFLOW_LOCAL_INVITES_ENABLED = 'true';
    await request(app.getHttpServer()).post(url).send(payload).expect(401);
    await request(app.getHttpServer())
      .post(url)
      .set('Authorization', 'Bearer teacher')
      .send(payload)
      .expect(403);
    expect(invite).not.toHaveBeenCalled();
  });

  it('rejects unsafe redirect injection and invalid role without calling the service', async () => {
    process.env.SWIMFLOW_LOCAL_INVITATION_API_ENABLED = 'true';
    process.env.SWIMFLOW_LOCAL_INVITES_ENABLED = 'true';
    for (const extra of [
      { redirectTo: 'https://attacker.example.invalid' },
      { role: 'owner' },
      { role: 'admin', arbitrary: 'field' },
    ]) {
      await request(app.getHttpServer())
        .post(url)
        .set('Authorization', 'Bearer admin')
        .send({ ...payload, ...extra })
        .expect(400);
    }
    expect(invite).not.toHaveBeenCalled();
  });

  it('passes only actor+validated recipient, responds without token, profile or delivery URL', async () => {
    process.env.SWIMFLOW_LOCAL_INVITATION_API_ENABLED = 'true';
    process.env.SWIMFLOW_LOCAL_INVITES_ENABLED = 'true';
    const response = await request(app.getHttpServer())
      .post(url)
      .set('Authorization', 'Bearer admin')
      .send(payload)
      .expect(201)
      .expect('Cache-Control', 'no-store');

    expect(response.body).toEqual({ data: { success: true } });
    expect(JSON.stringify(response.body)).not.toMatch(/token|athlete@|uuid|http/i);
    expect(invite).toHaveBeenCalledWith({
      actorUserId: 'ci-admin',
      email: payload.email.toLowerCase(),
      fullName: payload.fullName,
      role: payload.role,
    });
    expect(response.headers['set-cookie']).toBeUndefined();
  });
});
