import {
  INestApplication,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AuthDirectoryRepository } from '@/domain/auth/application/repositories/auth-directory-repository';
import { AuthProfilesRepository } from '@/domain/auth/application/repositories/auth-profiles-repository';
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard';
import { getPermissionsForRole } from '@/infra/auth/role-permissions';
import { createE2EApp, withDefaultTestOverrides } from './utils/create-e2e-app';

describe('Local access profiles admin listing (e2e)', () => {
  let app: INestApplication<App>;
  const listUsers = jest.fn().mockResolvedValue([
    {
      id: 'admin-user', email: 'admin@example.invalid',
      createdAt: new Date('2026-10-01T00:00:00Z'),
      lastSignInAt: new Date('2026-10-12T00:00:00Z'),
      emailConfirmedAt: new Date('2026-10-01T00:00:00Z'),
    },
    {
      id: 'pending-user', email: 'pending@example.invalid',
      createdAt: new Date('2026-10-24T00:00:00Z'),
      lastSignInAt: null, emailConfirmedAt: null,
    },
  ]);
  const role = (id: string) => id === 'admin-user' ? 'admin' : 'teacher';

  beforeAll(async () => {
    app = await createE2EApp((builder) =>
      withDefaultTestOverrides(builder)
        .overrideProvider(AuthDirectoryRepository)
        .useValue({ listUsers })
        .overrideProvider(AuthProfilesRepository)
        .useValue({
          list: async () => [
            {
              id: 'admin-user', fullName: 'Local Admin',
              role: 'admin', avatarUrl: null,
              permissions: getPermissionsForRole('admin'),
            },
            {
              id: 'pending-user', fullName: 'Invited Teacher',
              role: 'teacher', avatarUrl: null,
              permissions: getPermissionsForRole('teacher'),
            },
          ],
          findByUserId: async (id: string) => ({
            id, role: role(id), fullName: '', avatarUrl: null,
            permissions: getPermissionsForRole(role(id)),
          }),
        })
        .overrideGuard(JwtAuthGuard)
        .useValue({
          canActivate(ctx: ExecutionContext) {
            const req = ctx.switchToHttp().getRequest<{
              headers: { authorization?: string };
              user?: { id: string; email: string; sessionId: string };
            }>();
            const authorization = req.headers.authorization;
            if (authorization !== 'Bearer admin' && authorization !== 'Bearer teacher') {
              throw new UnauthorizedException('Missing bearer token');
            }
            const id = authorization === 'Bearer admin' ? 'admin-user' : 'teacher-user';
            req.user = { id, email: `${id}@example.invalid`, sessionId: 'ci-session' };
            return true;
          },
        }),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => listUsers.mockClear());

  it('returns the expected {data:{profiles}} with no secrets for an admin', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/access-profiles')
      .set('Authorization', 'Bearer admin')
      .expect(200);
    expect(response.body.data.profiles).toHaveLength(2);
    expect(response.body.data.profiles[0]).toMatchObject({
      email: 'admin@example.invalid', role: 'admin', access_state: 'active',
    });
    expect(response.body.data.profiles[1]).toMatchObject({
      email: 'pending@example.invalid', role: 'teacher', access_state: 'invited',
    });
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|tokenHash|disabledAt/);
    expect(listUsers).toHaveBeenCalledTimes(1);
  });

  it('denies an unauthenticated user or teacher without leaking the directory', async () => {
    await request(app.getHttpServer()).get('/api/auth/access-profiles').expect(401);
    await request(app.getHttpServer())
      .get('/api/auth/access-profiles')
      .set('Authorization', 'Bearer teacher')
      .expect(403);
    expect(listUsers).not.toHaveBeenCalled();
  });
});
