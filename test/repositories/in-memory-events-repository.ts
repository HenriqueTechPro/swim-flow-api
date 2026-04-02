import { AppError } from '@/shared/errors/app-error'
import type {
  CreateEventRepositoryInput,
  ListEventsRepositoryParams,
  UpdateEventRepositoryInput,
} from '@/domain/events/application/repositories/events-repository'
import { EventsRepository } from '@/domain/events/application/repositories/events-repository'
import type { Event } from '@/domain/events/enterprise/entities/event'
import { paginateItems } from '@/domain/shared/pagination/pagination-utils'
import { makeEvent } from '../factories/make-event'

export class InMemoryEventsRepository implements EventsRepository {
  public items: Event[] = []

  async list(params?: ListEventsRepositoryParams) {
    const search = params?.search?.trim().toLowerCase()
    const type = params?.type?.trim()
    const status = params?.status?.trim()

    const filteredItems = this.items.filter((item) => {
      const matchesSearch =
        !search ||
        item.title.toLowerCase().includes(search) ||
        item.location.toLowerCase().includes(search) ||
        item.description.toLowerCase().includes(search)
      const matchesType = !type || item.type === type
      const matchesStatus = !status || item.status === status

      return matchesSearch && matchesType && matchesStatus
    })

    return paginateItems(filteredItems, params)
  }

  async create(input: CreateEventRepositoryInput): Promise<Event> {
    const event = makeEvent({ ...input })
    this.items.push(event)
    return event
  }

  async update(id: string, input: UpdateEventRepositoryInput): Promise<Event> {
    const itemIndex = this.items.findIndex((item) => item.id === id)
    if (itemIndex < 0) throw new AppError(404, 'Event not found')

    const updatedEvent: Event = { ...this.items[itemIndex], ...input }
    this.items[itemIndex] = updatedEvent
    return updatedEvent
  }

  async remove(id: string): Promise<Event> {
    const itemIndex = this.items.findIndex((item) => item.id === id)
    if (itemIndex < 0) throw new AppError(404, 'Event not found')

    const [removedEvent] = this.items.splice(itemIndex, 1)
    return removedEvent
  }
}
