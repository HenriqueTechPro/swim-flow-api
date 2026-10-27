import {
  INestApplication,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AuthProfilesRepository } from '@/domain/auth/application/repositories/auth-profiles-repository';
import { ListAccessProfilesUseCase } from '@/domain/auth/application/use-cases/list-access-profiles';
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard';
import { getPermissionsForRole } from '@/infra/auth/role-permissions';
import { createE2EApp, withDefaultTestOverrides } from './utils/create-e2e-app';

describe('GET /api/auth/access-profiles (e2e)', () => {
  let app: INestApplication<App>;
  const execute = jest.fn();
  const path = '/api/auth/access-profiles';

  beforeEach(async () => {
    execute.mockReset();
    execute.mockResolvedValue({
      profiles: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          email: 'admin@example.invalid',
          fullName: 'Admin Example',
          avatarUrl: null,
          role: 'admin',
          permissions: getPermissionsForRole('admin'),
          createdAt: new Date('2026-10-01T00:00:00.000Z'),
          lastSignInAt: new Date('2026-10-20T00:00:00.000Z'),
          emailConfirmedAt: new Date('2026-10-02T00:00:00.000Z'),
        },
      ],
    });
    app = await createE2EApp((builder) =>
      withDefaultTestOverrides(builder)
        .overrideProvider(ListAccessProfilesUseCase)
        .useValue({ execute })
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
  });

  it('denies anonymous clients before the listing is executed', async () => {
    await request(app.getHttpServer()).get(path).expect(401);
    expect(execute).not.toHaveBeenCalled();
  });

  it('denies teachers without administrator rights', async () => {
    await request(app.getHttpServer())
      .get(path)
      .set('Authorization', 'Bearer teacher')
      .expect(403);
    expect(execute).not.toHaveBeenCalled();
  });

  it('returns a credential-free directory only to an authorized administrator', async () => {
    const response = await request(app.getHttpServer())
      .get(path)
      .set('Authorization', 'Bearer admin')
      .expect(200);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(response.body.data.profiles[0]).toMatchObject({
      email: 'admin@example.invalid',
      role: 'admin',
      access_state: 'active',
      full_name: 'Admin Example',
    });
    expect(response.body.data.profiles[0].created_at).toBe(
      '2026-10-01T00:00:00.000Z',
    );
    expect(JSON.stringify(response.body)).not.toMatch(
      /passwordHash|refreshTokenHash|tokenHash/i,
    );
  });
});
