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
import { App } from 'supertest/types';
import { EventsRepository } from '@/domain/events/application/repositories/events-repository';
import { makeEvent } from './factories/make-event';
import { InMemoryEventsRepository } from './repositories/in-memory-events-repository';
import { createAuthenticatedE2EApp } from './utils/create-e2e-app';

describe('EventsController (e2e)', () => {
  let app: INestApplication<App>;
  let eventsRepository: InMemoryEventsRepository;

  beforeEach(async () => {
    eventsRepository = new InMemoryEventsRepository();

    app = await createAuthenticatedE2EApp((builder) =>
      builder.overrideProvider(EventsRepository).useValue(eventsRepository),
    );
  });

  afterEach(async () => {
    await app.close();
  });

  it('lists, creates, updates and deletes events', async () => {
    const listBefore = await request(app.getHttpServer())
      .get('/api/events')
      .expect(200);
    expect(listBefore.body.data).toEqual([]);

    const createResponse = await request(app.getHttpServer())
      .post('/api/events')
      .send({
        title: 'Festival E2E',
        description: 'Evento criado no e2e',
        type: 'Festival',
        date: '2026-04-15',
        startTime: '08:00',
        endTime: '12:00',
        location: 'Piscina Principal',
        status: 'Agendado',
      })
      .expect(201);

    const eventId = createResponse.body.data.id as string;
    expect(createResponse.body.data.title).toBe('Festival E2E');

    const updateResponse = await request(app.getHttpServer())
      .put(`/api/events/${eventId}`)
      .send({
        title: 'Festival E2E Atualizado',
        description: 'Evento atualizado no e2e',
        type: 'Festival',
        date: '2026-04-16',
        startTime: '09:00',
        endTime: '13:00',
        location: 'Piscina Olimpica',
        status: 'Agendado',
      })
      .expect(200);

    expect(updateResponse.body.data.title).toBe('Festival E2E Atualizado');
    expect(updateResponse.body.data.location).toBe('Piscina Olimpica');

    const listAfter = await request(app.getHttpServer())
      .get('/api/events')
      .expect(200);
    expect(listAfter.body.data).toHaveLength(1);
    expect(listAfter.body.meta.total).toBe(1);

    const deleteResponse = await request(app.getHttpServer())
      .delete(`/api/events/${eventId}`)
      .expect(200);

    expect(deleteResponse.body.data.id).toBe(eventId);

    const listFinal = await request(app.getHttpServer())
      .get('/api/events')
      .expect(200);
    expect(listFinal.body.data).toEqual([]);
  });

  it('preserves explicit season on GET and PUT omission; null unlinks', async () => {
    const seasonId = '11111111-1111-4111-8111-111111111111';
    const input = {
      title: 'Festival 2027',
      type: 'Festival',
      date: '2027-05-18',
      startTime: '08:00',
      endTime: '11:00',
      location: 'Piscina',
      status: 'Agendado',
    };
    const created = await request(app.getHttpServer())
      .post('/api/events')
      .send({ ...input, seasonId })
      .expect(201);
    const id = created.body.data.id as string;
    expect(created.body.data.seasonId).toBe(seasonId);
    const read = await request(app.getHttpServer())
      .get(`/api/events/${id}`)
      .expect(200);
    expect(read.body.data.seasonId).toBe(seasonId);
    const preserved = await request(app.getHttpServer())
      .put(`/api/events/${id}`)
      .send(input)
      .expect(200);
    expect(preserved.body.data.seasonId).toBe(seasonId);
    const unlinked = await request(app.getHttpServer())
      .put(`/api/events/${id}`)
      .send({ ...input, seasonId: null })
      .expect(200);
    expect(unlinked.body.data.seasonId).toBeNull();
    await request(app.getHttpServer())
      .post('/api/events')
      .send({ ...input, seasonId: 'invalid-uuid' })
      .expect(400);
  });

  it('filters and paginates events list', async () => {
    eventsRepository.items.push(
      makeEvent({
        title: 'Festival Interno',
        description: 'Evento da equipe',
        type: 'Festival',
        location: 'Piscina Central',
        status: 'Agendado',
      }),
      makeEvent({
        title: 'Reuniao de Pais',
        description: 'Alinhamento mensal',
        type: 'Reuniao',
        location: 'Sala 2',
        status: 'Cancelado',
      }),
    );

    const response = await request(app.getHttpServer())
      .get(
        '/api/events?page=1&perPage=1&search=festival&type=Festival&status=Agendado',
      )
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].title).toBe('Festival Interno');
    expect(response.body.meta.total).toBe(1);
  });
});
