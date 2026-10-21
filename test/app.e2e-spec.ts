import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/infra/database/prisma/prisma.service';
import request from 'supertest';
import { App } from 'supertest/types';
import { createE2EApp, withDefaultTestOverrides } from './utils/create-e2e-app';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createE2EApp(withDefaultTestOverrides);
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((response) => {
        expect(response.body.status).toBe('ok');
        expect(response.body.service).toBe('swim-flow-nest-api');
      });
  });

  it('/health/ready (GET) confirms a real-query-shaped PostgreSQL round trip', async () => {
    const result = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200)
      .expect('Cache-Control', 'no-store');

    expect(result.body).toEqual({
      status: 'ready',
      service: 'swim-flow-nest-api',
      dependency: 'postgresql',
    });
    const prisma = jest.mocked(app.get(PrismaService));
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('/health/ready returns safe 503 when PostgreSQL becomes unavailable, without breaking liveness', async () => {
    const prisma = jest.mocked(app.get(PrismaService));
    prisma.$queryRaw.mockRejectedValueOnce(
      new Error('postgresql://private-secret:password@database.example/swimflow'),
    );

    const unavailable = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(503)
      .expect('Cache-Control', 'no-store');

    expect(unavailable.body).toMatchObject({
      status: 'unavailable',
      service: 'swim-flow-nest-api',
      dependency: 'postgresql',
    });
    expect(JSON.stringify(unavailable.body)).not.toMatch(/private-secret|password|database\.example/);

    await request(app.getHttpServer())
      .get('/health')
      .expect(200);
  });

  afterEach(async () => {
    await app.close();
  });
});
