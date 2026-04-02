import { beforeEach, describe, expect, it } from '@jest/globals'
import { AppError } from '@/shared/errors/app-error'
import { UpdateEventUseCase } from './update-event'
import { InMemoryEventsRepository } from '../../../../../test/repositories/in-memory-events-repository'
import { makeEvent } from '../../../../../test/factories/make-event'

describe('UpdateEventUseCase', () => {
  let eventsRepository: InMemoryEventsRepository
  let sut: UpdateEventUseCase

  beforeEach(() => {
    eventsRepository = new InMemoryEventsRepository()
    sut = new UpdateEventUseCase(eventsRepository)
  })

  it('updates an existing event', async () => {
    const existingEvent = makeEvent()
    eventsRepository.items.push(existingEvent)

    const { event } = await sut.execute(existingEvent.id, {
      title: 'Festival Atualizado',
      description: 'Evento atualizado',
      type: 'Festival',
      date: '2026-04-16',
      startTime: '09:00',
      endTime: '13:00',
      location: 'Piscina Olimpica',
      status: 'Agendado',
    })

    expect(event.title).toBe('Festival Atualizado')
    expect(event.location).toBe('Piscina Olimpica')
  })

  it('throws when event does not exist', async () => {
    await expect(() =>
      sut.execute('missing-event', {
        title: 'Festival Atualizado',
        description: 'Evento atualizado',
        type: 'Festival',
        date: '2026-04-16',
        startTime: '09:00',
        endTime: '13:00',
        location: 'Piscina Olimpica',
        status: 'Agendado',
      }),
    ).rejects.toBeInstanceOf(AppError)
  })
})
