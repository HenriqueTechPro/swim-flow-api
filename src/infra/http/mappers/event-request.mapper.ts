import type { CreateEventDto, UpdateEventDto } from '@/shared/contracts/events.contracts'
import type { CreateEventRequest, UpdateEventRequest } from '@/domain/events/application/dtos/event-requests'

export class EventRequestMapper {
  static toCreate(body: CreateEventDto): CreateEventRequest {
    return { ...body }
  }

  static toUpdate(body: UpdateEventDto): UpdateEventRequest {
    return { ...body }
  }
}
