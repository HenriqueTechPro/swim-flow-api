import { Injectable } from '@nestjs/common'
import { EventsRepository, type ListEventsRepositoryParams } from '../repositories/events-repository'
import { toPaginationMeta } from '@/domain/shared/pagination/pagination-utils'

@Injectable()
export class ListEventsUseCase {
  constructor(private readonly eventsRepository: EventsRepository) {}

  async execute(params?: ListEventsRepositoryParams) {
    const result = await this.eventsRepository.list(params)
    return {
      events: result.items,
      meta: toPaginationMeta(result),
    }
  }
}
