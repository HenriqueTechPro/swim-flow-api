import { EventsRepository } from '../repositories/events-repository';

export class DeleteEventUseCase {
  constructor(private readonly eventsRepository: EventsRepository) {}

  async execute(id: string) {
    const event = await this.eventsRepository.remove(id);
    return { event };
  }
}
