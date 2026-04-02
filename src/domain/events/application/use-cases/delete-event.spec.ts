import { beforeEach, describe, expect, it } from '@jest/globals'
import { AppError } from '@/shared/errors/app-error'
import { DeleteEventUseCase } from './delete-event'
import { InMemoryEventsRepository } from '../../../../../test/repositories/in-memory-events-repository'
import { makeEvent } from '../../../../../test/factories/make-event'

describe('DeleteEventUseCase', () => {
  let eventsRepository: InMemoryEventsRepository
  let sut: DeleteEventUseCase

  beforeEach(() => {
    eventsRepository = new InMemoryEventsRepository()
    sut = new DeleteEventUseCase(eventsRepository)
  })

  it('deletes an existing event', async () => {
    const existingEvent = makeEvent()
    eventsRepository.items.push(existingEvent)

    const { event } = await sut.execute(existingEvent.id)

    expect(event.id).toBe(existingEvent.id)
    expect(eventsRepository.items).toHaveLength(0)
  })

  it('throws when event does not exist', async () => {
    await expect(() => sut.execute('missing-event')).rejects.toBeInstanceOf(AppError)
  })
})
