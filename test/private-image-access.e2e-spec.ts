import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { ConflictException, NotFoundException } from '@nestjs/common';
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
const MEDIA = '33333333-3333-4333-8333-333333333333';
const OLD_MEDIA = '44444444-4444-4444-8444-444444444444';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

describe('Private image activation and read HTTP (e2e)', () => {
  let app: INestApplication<App>;
  const activate = jest.fn<PrivateImageAccessService['activate']>();
  const download = jest.fn<PrivateImageAccessService['download']>();

  beforeEach(async () => {
    activate.mockReset();
    download.mockReset();
    activate.mockResolvedValue({ mediaId: MEDIA, status: 'ACTIVE' });
    download.mockResolvedValue({
      stream: {
        async *[Symbol.asyncIterator]() {
          yield JPEG;
        },
      },
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': String(JPEG.length),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
    app = await createAuthenticatedE2EApp((builder) =>
      builder
        .overrideProvider(PrivateImageAccessService)
        .useValue({ activate, download })
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

  it('activates a verified image with an explicit optimistic old ID', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/uploads/private-image/' + MEDIA + '/activate')
      .send({ expectedMediaId: null })
      .expect(201);
    expect(first.body).toEqual({ data: { mediaId: MEDIA, status: 'ACTIVE' } });
    expect(JSON.stringify(first.body)).not.toMatch(/token|pathname|url/i);
    expect(activate).toHaveBeenCalledWith(ACTOR, MEDIA, null);

    await request(app.getHttpServer())
      .post('/api/uploads/private-image/' + MEDIA + '/activate')
      .send({ expectedMediaId: OLD_MEDIA })
      .expect(201);
    expect(activate).toHaveBeenCalledWith(ACTOR, MEDIA, OLD_MEDIA);
  });

  it('rejects invalid input before accessing storage and surfaces CAS conflict', async () => {
    await request(app.getHttpServer())
      .post('/api/uploads/private-image/' + MEDIA + '/activate')
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/uploads/private-image/' + MEDIA + '/activate')
      .send({ expectedMediaId: 'bad' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/uploads/private-image/bad/activate')
      .send({ expectedMediaId: null })
      .expect(400);
    expect(activate).not.toHaveBeenCalled();
    activate.mockRejectedValueOnce(new ConflictException('reference changed'));
    await request(app.getHttpServer())
      .post('/api/uploads/private-image/' + MEDIA + '/activate')
      .send({ expectedMediaId: OLD_MEDIA })
      .expect(409);
  });

  it('streams image bytes with no-store and never exposes object URLs', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/uploads/private-image/' + MEDIA)
      .expect(200)
      .expect('Cache-Control', 'private, no-store')
      .expect('X-Content-Type-Options', 'nosniff')
      .expect('Content-Type', /image\/jpeg/)
      .expect('Content-Length', String(JPEG.length));
    expect(res.body).toEqual(JPEG);
    expect(res.headers).not.toHaveProperty('location');
    expect(download).toHaveBeenCalledWith(ACTOR, MEDIA);
  });

  it('does not stream unbound or inaccessible images', async () => {
    download.mockRejectedValueOnce(new NotFoundException('Private media unavailable'));
    await request(app.getHttpServer())
      .get('/api/uploads/private-image/' + MEDIA)
      .expect(404);
    await request(app.getHttpServer())
      .get('/api/uploads/private-image/bad')
      .expect(400);
    expect(download).toHaveBeenCalledTimes(1);
  });
});

describe('Private image access remains authenticated (e2e)', () => {
  it('rejects unauthenticated read and activation', async () => {
    const app = await createE2EApp(withDefaultTestOverrides);
    try {
      await request(app.getHttpServer())
        .get('/api/uploads/private-image/' + MEDIA)
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/uploads/private-image/' + MEDIA + '/activate')
        .send({ expectedMediaId: null })
        .expect(401);
    } finally {
      await app.close();
    }
  });
});
