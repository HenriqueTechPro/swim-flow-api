import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ResultSeasonsRepository } from '@/domain/results/application/repositories/result-seasons-repository';
import { AppError } from '@/shared/errors/app-error';
import { ResultSeasonsController } from '@/infra/http/controllers/result-seasons.controller';
import { ROLES_KEY } from '@/infra/auth/roles.decorator';
import { PERMISSIONS_KEY } from '@/infra/auth/permissions.decorator';
import {
  createAuthenticatedE2EApp,
  createE2EApp,
  withDefaultTestOverrides,
} from './utils/create-e2e-app';

describe('Result season options (e2e)', () => {
  let app: INestApplication<App>;
  const list = jest.fn();
  const create = jest.fn();
  const update = jest.fn();
  const overview = jest.fn();
  const studentComposition = jest.fn();
  const categoryRolloverPreview = jest.fn();
  const seasonId = '88888888-8888-4888-8888-888888888888';
  const payload = {
    year: 2026,
    label: 'Temporada 2025/2026',
    startsOn: '2025-09-01',
    endsOn: '2026-08-31',
    status: 'ACTIVE',
  };
  const get = (url: string) => request(app.getHttpServer()).get(url);

  beforeEach(async () => {
    list.mockReset();
    create.mockReset();
    update.mockReset();
    overview.mockReset();
    studentComposition.mockReset();
    categoryRolloverPreview.mockReset();
    overview.mockResolvedValue({
      season: { id: seasonId, ...payload },
      filters: { discipline: 'all' },
      events: {
        linked: 4,
        withoutSeasonInPeriod: 1,
        options: [],
        optionsTruncated: false,
      },
      races: { pool: 3, openWater: 2 },
      results: {
        pool: 45,
        openWater: 20,
        poolWithoutSeasonInPeriod: 2,
        openWaterWithoutSeasonInPeriod: 1,
      },
    });
    studentComposition.mockResolvedValue({
      season: { id: seasonId, ...payload },
      categoriesRegistered: 60,
      participants: { distinct: 27, pool: 20, openWater: 15 },
      enrolledDuringPeriod: 43,
    });
    categoryRolloverPreview.mockResolvedValue({
      source: { id: seasonId, ...payload },
      target: {
        id: '99999999-9999-4999-8999-999999999999',
        ...payload,
        year: 2027,
      },
      items: [],
      meta: { page: 1, perPage: 25, total: 0, totalPages: 0 },
      readOnly: true,
    });
    create.mockImplementation(async (input: object) => ({
      id: seasonId,
      ...input,
    }));
    update.mockImplementation(async (_id: string, input: object) => ({
      id: seasonId,
      ...input,
    }));
    list.mockResolvedValue({
      items: [],
      page: 1,
      perPage: 25,
      total: 0,
    });
    app = await createAuthenticatedE2EApp((builder) =>
      builder
        .overrideProvider(ResultSeasonsRepository)
        .useValue({
          list,
          create,
          update,
          overview,
          studentComposition,
          categoryRolloverPreview,
        }),
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
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        ResultSeasonsController.prototype.overview,
      ),
    ).toEqual(['results:read']);
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        ResultSeasonsController.prototype.studentComposition,
      ),
    ).toEqual(['results:read']);
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        ResultSeasonsController.prototype.categoryRolloverPreview,
      ),
    ).toEqual(['students:read']);
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        ResultSeasonsController.prototype.create,
      ),
    ).toEqual(['results:write']);
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        ResultSeasonsController.prototype.update,
      ),
    ).toEqual(['results:write']);
  });

  it('returns a paginated empty list', async () => {
    const response = await get('/api/results/seasons').expect(200);

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
    const query = '/api/results/seasons?page=2&perPage=10';
    const response = await get(query).expect(200);

    expect(response.body.data[0]).toMatchObject({
      year: 2026,
      startsOn: '2025-09-01',
      endsOn: '2026-08-31',
    });
    expect(response.body.meta.total).toBe(12);
    expect(list).toHaveBeenCalledWith({ page: 2, perPage: 10 });
  });

  it('rejects invalid pagination before querying the repository', async () => {
    await get('/api/results/seasons?page=0').expect(400);
    await get('/api/results/seasons?perPage=101').expect(400);
    await get('/api/results/seasons?page=hello').expect(400);
    expect(list).not.toHaveBeenCalled();
  });

  it('returns read-only counts and validates overview filters', async () => {
    const url = `/api/results/seasons/${seasonId}/overview`;
    const response = await get(
      `${url}?discipline=Piscina&category=Mirim&studentSearch=Ana`,
    ).expect(200);
    expect(response.body.data).toMatchObject({
      events: { linked: 4, withoutSeasonInPeriod: 1 },
      results: { pool: 45, openWater: 20 },
    });
    expect(overview).toHaveBeenCalledWith(seasonId, {
      discipline: 'Piscina',
      category: 'Mirim',
      studentSearch: 'Ana',
    });
    await get(`${url}?discipline=Other`).expect(400);
    await get(`${url}?studentSearch=A`).expect(400);
    await get(`/api/results/seasons/not-uuid/overview`).expect(400);
    expect(overview).toHaveBeenCalledTimes(1);
  });

  it('returns real distinct student composition without modifying history', async () => {
    const url = `/api/results/seasons/${seasonId}/student-composition`;
    const response = await get(url).expect(200);
    expect(response.body.data).toMatchObject({
      categoriesRegistered: 60,
      participants: { distinct: 27, pool: 20, openWater: 15 },
      enrolledDuringPeriod: 43,
    });
    expect(studentComposition).toHaveBeenCalledTimes(1);
    expect(studentComposition).toHaveBeenCalledWith(seasonId);
    await get('/api/results/seasons/not-uuid/student-composition').expect(400);
    expect(studentComposition).toHaveBeenCalledTimes(1);
  });

  it('only reads a validated, paginated rollover preview', async () => {
    const url = `/api/results/seasons/${seasonId}/category-rollover-preview`;
    const response = await get(`${url}?page=2&perPage=10`).expect(200);
    expect(response.body.data.readOnly).toBe(true);
    expect(categoryRolloverPreview).toHaveBeenCalledWith(seasonId, {
      page: 2,
      perPage: 10,
    });
    await get(`${url}?page=0`).expect(400);
    await get(`${url}?perPage=100`).expect(400);
    await get('/api/results/seasons/not-uuid/category-rollover-preview').expect(
      400,
    );
    expect(categoryRolloverPreview).toHaveBeenCalledTimes(1);
  });

  it('defaults new season status to PLANNED', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/results/seasons')
      .send({
        year: 2026,
        label: payload.label,
        startsOn: payload.startsOn,
        endsOn: payload.endsOn,
      })
      .expect(201);
    expect(create).toHaveBeenCalledWith({ ...payload, status: 'PLANNED' });
    expect(response.body.data).toMatchObject({
      id: seasonId,
      label: payload.label,
      status: 'PLANNED',
    });
  });

  it('updates a season with a validated payload', async () => {
    const response = await request(app.getHttpServer())
      .put(`/api/results/seasons/${seasonId}`)
      .send(payload)
      .expect(200);
    expect(update).toHaveBeenCalledWith(seasonId, payload);
    expect(response.body.data).toMatchObject({
      id: seasonId,
      status: 'ACTIVE',
    });
  });

  it('rejects invalid dates, year, label and lifecycle status', async () => {
    const post = (data: object) =>
      request(app.getHttpServer()).post('/api/results/seasons').send(data);

    await post({ ...payload, startsOn: '2026-02-30' }).expect(400);
    await post({ ...payload, endsOn: '2024-12-31' }).expect(400);
    await post({ ...payload, status: 'UNKNOWN' }).expect(400);
    await post({ ...payload, year: 1800 }).expect(400);
    await post({ ...payload, label: '' }).expect(400);
    await request(app.getHttpServer())
      .put(`/api/results/seasons/${seasonId}`)
      .send({ ...payload, status: undefined })
      .expect(400);

    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('returns 409 for conflicting season periods', async () => {
    create.mockRejectedValueOnce(new AppError(409, 'Season dates overlap'));
    await request(app.getHttpServer())
      .post('/api/results/seasons')
      .send(payload)
      .expect(409);
  });

  it('denies anonymous access', async () => {
    await app.close();
    app = await createE2EApp((builder) =>
      withDefaultTestOverrides(builder)
        .overrideProvider(ResultSeasonsRepository)
        .useValue({
          list,
          create,
          update,
          overview,
          studentComposition,
          categoryRolloverPreview,
        }),
    );

    await get('/api/results/seasons').expect(401);
    expect(list).not.toHaveBeenCalled();
  });
});
