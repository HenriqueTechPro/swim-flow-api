import { Injectable } from '@nestjs/common'
import { EventsRepository } from '../repositories/events-repository'

@Injectable()
export class DeleteEventUseCase {
  constructor(private readonly eventsRepository: EventsRepository) {}

  async execute(id: string) {
    const event = await this.eventsRepository.remove(id)
    return { event }
  }
}
