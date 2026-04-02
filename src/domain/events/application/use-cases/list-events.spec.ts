import { beforeEach, describe, expect, it } from '@jest/globals'
import { ListEventsUseCase } from './list-events'
import { InMemoryEventsRepository } from '../../../../../test/repositories/in-memory-events-repository'
import { makeEvent } from '../../../../../test/factories/make-event'

describe('ListEventsUseCase', () => {
  let eventsRepository: InMemoryEventsRepository
  let sut: ListEventsUseCase

  beforeEach(() => {
    eventsRepository = new InMemoryEventsRepository()
    sut = new ListEventsUseCase(eventsRepository)
  })

  it('lists events', async () => {
    eventsRepository.items.push(makeEvent({ title: 'Evento 1' }))
    eventsRepository.items.push(makeEvent({ title: 'Evento 2' }))

    const { events } = await sut.execute()

    expect(events).toHaveLength(2)
    expect(events.map((event) => event.title)).toEqual(['Evento 1', 'Evento 2'])
  })
})
