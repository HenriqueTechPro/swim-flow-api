import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { INestApplication, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AuthProfilesRepository } from '@/domain/auth/application/repositories/auth-profiles-repository';
import { TeacherAccountLinksRepository } from '@/domain/teachers/application/repositories/teacher-account-links-repository';
import { getPermissionsForRole } from '@/infra/auth/role-permissions';
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard';
import { createE2EApp, withDefaultTestOverrides } from './utils/create-e2e-app';

const actorId = '33333333-3333-4333-8333-333333333333';
const teacherId = '11111111-1111-4111-8111-111111111111';
const profileId = '22222222-2222-4222-8222-222222222222';

describe('Teacher account links (e2e, real role and permission guards)', () => {
  let app: INestApplication<App>;
  let role: 'admin' | 'teacher' | 'user';
  let linkedProfileId: string | null;
  const log: Array<{ actorProfileId: string; teacherId: string; profileId?: string }> = [];

  beforeEach(async () => {
    role = 'admin';
    linkedProfileId = null;
    log.length = 0;

    const repository: TeacherAccountLinksRepository = {
      async find(id) { return { teacherId: id, profileId: linkedProfileId }; },
      async link(input) {
        log.push(input);
        linkedProfileId = input.profileId;
        return { teacherId: input.teacherId, profileId: linkedProfileId };
      },
      async unlink(input) {
        log.push(input);
        linkedProfileId = null;
        return { teacherId: input.teacherId, profileId: null };
      },
    };

    app = await createE2EApp((builder) =>
      withDefaultTestOverrides(builder)
        .overrideGuard(JwtAuthGuard)
        .useValue({
          canActivate(context: ExecutionContext) {
            const req = context.switchToHttp().getRequest<{
              user?: { id: string; email: string; sessionId: string };
            }>();
            req.user = { id: actorId, email: 'admin@example.test', sessionId: 'test-session' };
            return true;
          },
        })
        .overrideProvider(AuthProfilesRepository)
        .useValue({
          findByUserId: async () => ({
            id: actorId,
            role,
            permissions: getPermissionsForRole(role),
            fullName: 'Test user',
            avatarUrl: null,
          }),
        })
        .overrideProvider(TeacherAccountLinksRepository)
        .useValue(repository),
    );
  });

  afterEach(async () => {
    await app.close();
  });

  it('allows an administrator to link, view and unlink a verified teacher profile', async () => {
    const put = await request(app.getHttpServer())
      .put(`/api/teachers/${teacherId}/account`)
      .send({ profileId })
      .expect(200);

    expect(put.body.data).toEqual({ teacherId, profileId });
    expect(log[0]).toEqual({ teacherId, profileId, actorProfileId: actorId });

    const get = await request(app.getHttpServer())
      .get(`/api/teachers/${teacherId}/account`)
      .expect(200);
    expect(get.body.data.profileId).toBe(profileId);

    const deleted = await request(app.getHttpServer())
      .delete(`/api/teachers/${teacherId}/account`)
      .expect(200);
    expect(deleted.body.data.profileId).toBeNull();
    expect(log[1].actorProfileId).toBe(actorId);
  });

  it.each(['teacher', 'user'] as const)(
    'returns 403 without invoking repository for role %s',
    async (deniedRole) => {
      role = deniedRole;
      await request(app.getHttpServer())
        .put(`/api/teachers/${teacherId}/account`)
        .send({ profileId })
        .expect(403);
      await request(app.getHttpServer())
        .get(`/api/teachers/${teacherId}/account`)
        .expect(403);
      await request(app.getHttpServer())
        .delete(`/api/teachers/${teacherId}/account`)
        .expect(403);
      expect(log).toHaveLength(0);
    },
  );

  it('rejects forged role fields and invalid UUIDs before persistence', async () => {
    await request(app.getHttpServer())
      .put(`/api/teachers/${teacherId}/account`)
      .send({ profileId, role: 'admin' })
      .expect(400);
    await request(app.getHttpServer())
      .put(`/api/teachers/${teacherId}/account`)
      .send({ profileId: 'unknown-account' })
      .expect(400);
    await request(app.getHttpServer())
      .put('/api/teachers/not-a-uuid/account')
      .send({ profileId })
      .expect(400);
    expect(log).toHaveLength(0);
  });
});
