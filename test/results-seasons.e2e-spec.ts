import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ResultSeasonsRepository } from '@/domain/results/application/repositories/result-seasons-repository';
import { ResultSeasonsController } from '@/infra/http/controllers/result-seasons.controller';
import { ROLES_KEY } from '@/infra/auth/roles.decorator';
import { PERMISSIONS_KEY } from '@/infra/auth/permissions.decorator';
import {
  createAuthenticatedE2EApp,
  createE2EApp,
} from './utils/create-e2e-app';

describe('Result season options (e2e)', () => {
  let app: INestApplication<App>;
  const list = jest.fn();

  beforeEach(async () => {
    list.mockReset();
    list.mockResolvedValue({
      items: [],
      page: 1,
      perPage: 25,
      total: 0,
    });
    app = await createAuthenticatedE2EApp((builder) =>
      builder.overrideProvider(ResultSeasonsRepository).useValue({ list }),
    );
  });

  afterEach(async () => {
    await app.close();
  });

  it('requires admin role and results read permission', () => {
    expect(Reflect.getMetadata(ROLES_KEY, ResultSeasonsController)).toEqual([
      'admin',
    ]);
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        ResultSeasonsController.prototype.index,
      ),
    ).toEqual(['results:read']);
  });

  it('returns a paginated empty list', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/results/seasons')
      .expect(200);

    expect(response.body).toEqual({
      data: [],
      meta: { page: 1, perPage: 25, total: 0 },
    });
    expect(list).toHaveBeenCalledWith({ page: 1, perPage: 25 });
  });

  it('validates and passes pagination to the use case', async () => {
    list.mockResolvedValueOnce({
      items: [
        {
          id: '88888888-8888-4888-8888-888888888888',
          year: 2026,
          label: 'Temporada 2026',
          startsOn: '2025-09-01',
          endsOn: '2026-08-31',
          status: 'ACTIVE',
        },
      ],
      page: 2,
      perPage: 10,
      total: 12,
    });
    const response = await request(app.getHttpServer())
      .get('/api/results/seasons?page=2&perPage=10')
      .expect(200);

    expect(response.body.data[0]).toMatchObject({
      year: 2026,
      startsOn: '2025-09-01',
      endsOn: '2026-08-31',
    });
    expect(response.body.meta.total).toBe(12);
    expect(list).toHaveBeenCalledWith({ page: 2, perPage: 10 });
  });

  it('rejects invalid pagination before querying the repository', async () => {
    await request(app.getHttpServer())
      .get('/api/results/seasons?page=0')
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/results/seasons?perPage=101')
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/results/seasons?page=hello')
      .expect(400);
    expect(list).not.toHaveBeenCalled();
  });

  it('denies anonymous access', async () => {
    await app.close();
    app = await createE2EApp((builder) =>
      builder.overrideProvider(ResultSeasonsRepository).useValue({ list }),
    );

    await request(app.getHttpServer())
      .get('/api/results/seasons')
      .expect(401);
    expect(list).not.toHaveBeenCalled();
  });
});
