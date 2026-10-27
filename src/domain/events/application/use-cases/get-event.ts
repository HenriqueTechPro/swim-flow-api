import { AppError } from '@/shared/errors/app-error';
import { EventsRepository } from '../repositories/events-repository';

export class GetEventUseCase {
  constructor(private readonly repository: EventsRepository) {}

  async execute(id: string) {
    const event = await this.repository.findById(id);
    if (!event) throw new AppError(404, 'Event not found');
    return { event };
  }
}
