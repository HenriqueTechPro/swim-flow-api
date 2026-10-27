import { beforeEach, describe, expect, it } from '@jest/globals';
import { GetEventUseCase } from './get-event';
import { InMemoryEventsRepository } from '../../../../../test/repositories/in-memory-events-repository';
import { makeEvent } from '../../../../../test/factories/make-event';

describe('GetEventUseCase', () => {
  let repository: InMemoryEventsRepository;
  let sut: GetEventUseCase;

  beforeEach(() => {
    repository = new InMemoryEventsRepository();
    sut = new GetEventUseCase(repository);
  });

  it('loads the requested UUID instead of listing the entire catalog', async () => {
    const first = makeEvent({ title: 'Event A' });
    const second = makeEvent({ title: 'Event B' });
    repository.items.push(first, second);

    const { event } = await sut.execute(second.id);
    expect(event.id).toBe(second.id);
    expect(event.title).toBe('Event B');
  });

  it('returns 404 for an unknown UUID', async () => {
    await expect(
      sut.execute('11111111-1111-4111-8111-111111111111'),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
