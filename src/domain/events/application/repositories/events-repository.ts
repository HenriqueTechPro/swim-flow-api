import type { Event } from '@/domain/events/enterprise/entities/event'
import type { CreateEventRequest, UpdateEventRequest } from '../dtos/event-requests'
import type { PaginatedResult, PaginationParams } from '@/domain/shared/pagination/pagination-params'

export interface CreateEventRepositoryInput extends CreateEventRequest {}
export interface UpdateEventRepositoryInput extends UpdateEventRequest {}
export interface ListEventsRepositoryParams extends PaginationParams {
  search?: string
  type?: string
  status?: string
}

export abstract class EventsRepository {
  abstract list(params?: ListEventsRepositoryParams): Promise<PaginatedResult<Event>>
  abstract create(input: CreateEventRepositoryInput): Promise<Event>
  abstract update(id: string, input: UpdateEventRepositoryInput): Promise<Event>
  abstract remove(id: string): Promise<Event>
}
