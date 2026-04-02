import { Injectable } from '@nestjs/common'
import { TrainingsRepository } from '../repositories/trainings-repository'
import type { ListTrainingsRepositoryParams } from '../repositories/trainings-repository'
import { toPaginationMeta } from '@/domain/shared/pagination/pagination-utils'

@Injectable()
export class ListTrainingsUseCase {
  constructor(private readonly trainingsRepository: TrainingsRepository) {}

  async execute(params?: ListTrainingsRepositoryParams) {
    const result = await this.trainingsRepository.list(params)
    return {
      trainings: result.items,
      meta: toPaginationMeta(result),
    }
  }
}
