import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard';
import { PrivateImageAccessService } from '@/infra/http/services/private-image-access.service';
import {
  createAuthenticatedE2EApp,
  createE2EApp,
  withDefaultTestOverrides,
} from './utils/create-e2e-app';

const ACTOR = '11111111-1111-4111-8111-111111111111';
const STUDENT = '22222222-2222-4222-8222-222222222222';
const MEDIA = '44444444-4444-4444-8444-444444444444';

describe('POST /api/uploads/private-images/active-references (e2e)', () => {
  let app: INestApplication<App>;
  const activeReferences =
    jest.fn<PrivateImageAccessService['activeReferences']>();

  beforeEach(async () => {
    activeReferences.mockReset();
    activeReferences.mockResolvedValue({
      references: [{ resourceId: STUDENT, mediaId: MEDIA }],
    });
    app = await createAuthenticatedE2EApp((builder) =>
      builder
        .overrideProvider(PrivateImageAccessService)
        .useValue({ activeReferences })
        .overrideGuard(JwtAuthGuard)
        .useValue({
          canActivate(context: {
            switchToHttp: () => { getRequest: () => { user: unknown } };
          }) {
            context.switchToHttp().getRequest().user = {
              id: ACTOR,
              role: 'admin',
              permissions: ['uploads:write'],
            };
            return true;
          },
        }),
    );
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns opaque media IDs without storage URLs', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/uploads/private-images/active-references')
      .send({ target: 'student-photo', resourceIds: [STUDENT] })
      .expect(201)
      .expect('Cache-Control', 'private, no-store')
      .expect('X-Content-Type-Options', 'nosniff');
    expect(response.body).toEqual({
      data: { references: [{ resourceId: STUDENT, mediaId: MEDIA }] },
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /token|objectKey|pathname|url/i,
    );
    expect(activeReferences).toHaveBeenCalledWith(ACTOR, 'student-photo', [
      STUDENT,
    ]);
  });

  it('rejects malformed and oversized pages', async () => {
    for (const body of [
      { target: 'invalid', resourceIds: [STUDENT] },
      { target: 'student-photo', resourceIds: [] },
      { target: 'student-photo', resourceIds: [STUDENT, STUDENT] },
      { target: 'student-photo', resourceIds: ['not-a-uuid'] },
      { target: 'student-photo', resourceIds: Array(26).fill(STUDENT) },
      { target: 'student-photo', resourceIds: [STUDENT], secret: 'x' },
    ]) {
      await request(app.getHttpServer())
        .post('/api/uploads/private-images/active-references')
        .send(body)
        .expect(400);
    }
    expect(activeReferences).not.toHaveBeenCalled();
  });
});

describe('Private active reference authentication (e2e)', () => {
  it('requires JWT even when the feature is switched off', async () => {
    const app = await createE2EApp(withDefaultTestOverrides);
    try {
      await request(app.getHttpServer())
        .post('/api/uploads/private-images/active-references')
        .send({ target: 'profile-avatar', resourceIds: [ACTOR] })
        .expect(401);
    } finally {
      await app.close();
    }
  });
});
