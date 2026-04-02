import { Injectable } from '@nestjs/common'
import type { UpdateEventRequest } from '../dtos/event-requests'
import { EventsRepository } from '../repositories/events-repository'

@Injectable()
export class UpdateEventUseCase {
  constructor(private readonly eventsRepository: EventsRepository) {}

  async execute(id: string, input: UpdateEventRequest) {
    const event = await this.eventsRepository.update(id, input)
    return { event }
  }
}
