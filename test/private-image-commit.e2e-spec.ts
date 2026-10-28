import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { ConflictException } from '@nestjs/common';
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
const MEDIA = '33333333-3333-4333-8333-333333333333';
const OLD = '44444444-4444-4444-8444-444444444444';
const payload = {
  target: 'student-photo',
  resourceId: STUDENT,
  newMediaId: MEDIA,
  expectedMediaId: OLD,
  expectedLegacyUrl: 'https://legacy.example.invalid/old.jpg',
};

describe('02F-06B3D private photo commit (HTTP e2e)', () => {
  let app: INestApplication<App>;
  const commit = jest.fn<PrivateImageAccessService['commit']>();

  beforeEach(async () => {
    commit.mockReset();
    commit.mockResolvedValue({ mediaId: MEDIA, status: 'ACTIVE' });
    app = await createAuthenticatedE2EApp((builder) =>
      builder
        .overrideProvider(PrivateImageAccessService)
        .useValue({ commit })
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

  it('commits via explicit CAS and returns no storage secrets', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/uploads/private-images/commit')
      .send(payload)
      .expect(201)
      .expect('Cache-Control', 'private, no-store')
      .expect('X-Content-Type-Options', 'nosniff');
    expect(response.body).toEqual({
      data: { mediaId: MEDIA, status: 'ACTIVE' },
    });
    expect(commit).toHaveBeenCalledWith(ACTOR, payload);
    expect(JSON.stringify(response.body)).not.toMatch(/token|url|path/i);
  });

  it('allows conditional removal and propagates stale 409', async () => {
    commit.mockResolvedValueOnce({ mediaId: null, status: 'REMOVED' });
    await request(app.getHttpServer())
      .post('/api/uploads/private-images/commit')
      .send({ ...payload, newMediaId: null })
      .expect(201);
    commit.mockRejectedValueOnce(new ConflictException('Changed'));
    await request(app.getHttpServer())
      .post('/api/uploads/private-images/commit')
      .send(payload)
      .expect(409);
  });

  it('rejects ambiguous or malformed requests before entering domain', async () => {
    for (const body of [
      { ...payload, newMediaId: null, expectedMediaId: null },
      { ...payload, newMediaId: OLD },
      { ...payload, expectedLegacyUrl: undefined },
      { ...payload, expectedMediaId: undefined },
      { ...payload, target: 'other' },
      { ...payload, newMediaId: 'not-uuid' },
      { ...payload, secret: 'inject' },
      { ...payload, expectedLegacyUrl: 'a'.repeat(2049) },
    ]) {
      await request(app.getHttpServer())
        .post('/api/uploads/private-images/commit')
        .send(body)
        .expect(400);
    }
    expect(commit).not.toHaveBeenCalled();
  });
});

describe('02F-06B3D commit route security', () => {
  it('rejects unauthenticated calls before accessing the database', async () => {
    const app = await createE2EApp(withDefaultTestOverrides);
    try {
      await request(app.getHttpServer())
        .post('/api/uploads/private-images/commit')
        .send(payload)
        .expect(401);
    } finally {
      await app.close();
    }
  });
});
