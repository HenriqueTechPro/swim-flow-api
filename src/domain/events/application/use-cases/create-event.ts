import type { CreateEventRequest } from '../dtos/event-requests';
import { EventsRepository } from '../repositories/events-repository';

export class CreateEventUseCase {
  constructor(private readonly eventsRepository: EventsRepository) {}

  async execute(input: CreateEventRequest) {
    const event = await this.eventsRepository.create(input);
    return { event };
  }
}
