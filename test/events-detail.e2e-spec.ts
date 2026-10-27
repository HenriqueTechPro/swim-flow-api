import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { EventsRepository } from '@/domain/events/application/repositories/events-repository';
import { InMemoryEventsRepository } from './repositories/in-memory-events-repository';
import { makeEvent } from './factories/make-event';
import { createAuthenticatedE2EApp } from './utils/create-e2e-app';

describe('EventsController GET by UUID (e2e)', () => {
  let app: INestApplication<App>;
  let repository: InMemoryEventsRepository;

  beforeEach(async () => {
    repository = new InMemoryEventsRepository();
    app = await createAuthenticatedE2EApp((builder) =>
      builder.overrideProvider(EventsRepository).useValue(repository),
    );
  });

  afterEach(async () => {
    await app.close();
  });

  it('keeps event details in the existing presenter contract', async () => {
    const event = makeEvent({ title: 'Festival Detail' });
    repository.items.push(event);

    const response = await request(app.getHttpServer())
      .get(`/api/events/${event.id}`)
      .expect(200);

    expect(response.body.data.id).toBe(event.id);
    expect(response.body.data.title).toBe(event.title);
    expect(response.body.data.location).toBe(event.location);
  });

  it('responds 400 for invalid UUID and 404 for missing event', async () => {
    await request(app.getHttpServer())
      .get('/api/events/not-a-uuid')
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/events/11111111-1111-4111-8111-111111111111')
      .expect(404);
  });
});
