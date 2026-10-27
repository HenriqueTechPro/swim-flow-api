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
import { PrivateImageUploadService } from '@/infra/http/services/private-image-upload.service';
import {
  createAuthenticatedE2EApp,
  createE2EApp,
} from './utils/create-e2e-app';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const STUDENT_ID = '22222222-2222-4222-8222-222222222222';
const UPLOAD_ID = '33333333-3333-4333-8333-333333333333';

describe('POST /api/uploads/private-image (e2e)', () => {
  let app: INestApplication<App>;
  const upload = jest.fn<PrivateImageUploadService['execute']>();

  beforeEach(async () => {
    upload.mockReset();
    upload.mockResolvedValue({ uploadId: UPLOAD_ID, status: 'VERIFIED' });
    app = await createAuthenticatedE2EApp((builder) =>
      builder
        .overrideProvider(PrivateImageUploadService)
        .useValue({ execute: upload })
        .overrideGuard(JwtAuthGuard)
        .useValue({
          canActivate(context: {
            switchToHttp: () => { getRequest: () => { user: unknown } };
          }) {
            context.switchToHttp().getRequest().user = {
              id: ACTOR_ID,
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

  it('returns opaque verified media receipt after upload', async () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]);
    const response = await request(app.getHttpServer())
      .post('/api/uploads/private-image')
      .field('target', 'student-photo')
      .field('resourceId', STUDENT_ID)
      .attach('file', bytes, {
        filename: 'photo.png',
        contentType: 'image/png',
      })
      .expect(201);

    expect(response.body).toEqual({
      data: { uploadId: UPLOAD_ID, status: 'VERIFIED' },
    });
    expect(JSON.stringify(response.body)).not.toMatch(/token|url|pathname|path/i);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0]?.[0]).toBe(ACTOR_ID);
    expect(upload.mock.calls[0]?.[1]).toMatchObject({
      target: 'student-photo',
      resourceId: STUDENT_ID,
      contentType: 'image/png',
      bytes,
    });
  });

  it('allows own profile but rejects resource ID on avatar', async () => {
    await request(app.getHttpServer())
      .post('/api/uploads/private-image')
      .field('target', 'profile-avatar')
      .attach('file', Buffer.alloc(8, 0xff), 'avatar.jpg')
      .expect(201);
    expect(upload.mock.calls.at(-1)?.[1]).toMatchObject({
      target: 'profile-avatar',
      resourceId: undefined,
    });

    await request(app.getHttpServer())
      .post('/api/uploads/private-image')
      .field('target', 'profile-avatar')
      .field('resourceId', STUDENT_ID)
      .attach('file', Buffer.alloc(8, 0xff), 'avatar.jpg')
      .expect(400);
  });

  it('rejects bad multipart file, type, UUID and oversized bytes', async () => {
    await request(app.getHttpServer())
      .post('/api/uploads/private-image')
      .field('target', 'student-photo')
      .field('resourceId', STUDENT_ID)
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/uploads/private-image')
      .field('target', 'student-photo')
      .field('resourceId', STUDENT_ID)
      .attach('file', Buffer.alloc(8), {
        filename: 'attack.svg',
        contentType: 'image/svg+xml',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/uploads/private-image')
      .field('target', 'student-photo')
      .field('resourceId', 'invalid-uuid')
      .attach('file', Buffer.alloc(8), 'photo.jpg')
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/uploads/private-image')
      .field('target', 'student-photo')
      .field('resourceId', STUDENT_ID)
      .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), 'huge.jpg')
      .expect(413);

    expect(upload).not.toHaveBeenCalled();
  });
});

describe('Private upload closed-by-default (e2e)', () => {
  it('rejects unauthenticated requests before storage is accessed', async () => {
    const app = await createE2EApp();
    try {
      await request(app.getHttpServer())
        .post('/api/uploads/private-image')
        .expect(401);
    } finally {
      await app.close();
    }
  });
});
