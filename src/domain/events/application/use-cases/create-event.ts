import { Injectable } from '@nestjs/common'
import type { CreateEventRequest } from '../dtos/event-requests'
import { EventsRepository } from '../repositories/events-repository'

@Injectable()
export class CreateEventUseCase {
  constructor(private readonly eventsRepository: EventsRepository) {}

  async execute(input: CreateEventRequest) {
    const event = await this.eventsRepository.create(input)
    return { event }
  }
}
