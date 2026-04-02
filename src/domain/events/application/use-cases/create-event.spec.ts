import { beforeEach, describe, expect, it } from '@jest/globals'
import { CreateEventUseCase } from './create-event'
import { InMemoryEventsRepository } from '../../../../../test/repositories/in-memory-events-repository'

describe('CreateEventUseCase', () => {
  let eventsRepository: InMemoryEventsRepository
  let sut: CreateEventUseCase

  beforeEach(() => {
    eventsRepository = new InMemoryEventsRepository()
    sut = new CreateEventUseCase(eventsRepository)
  })

  it('creates an event', async () => {
    const { event } = await sut.execute({
      title: 'Festival API',
      description: 'Evento de teste',
      type: 'Festival',
      date: '2026-04-15',
      startTime: '08:00',
      endTime: '12:00',
      location: 'Piscina Principal',
      status: 'Agendado',
    })

    expect(event.id).toEqual(expect.any(String))
    expect(eventsRepository.items).toHaveLength(1)
  })
})
