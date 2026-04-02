import { Injectable } from '@nestjs/common'
import { ClassesRepository, type ListClassesRepositoryParams } from '../repositories/classes-repository'
import { toPaginationMeta } from '@/domain/shared/pagination/pagination-utils'

@Injectable()
export class ListClassesUseCase {
  constructor(private readonly classesRepository: ClassesRepository) {}

  async execute(params?: ListClassesRepositoryParams) {
    const result = await this.classesRepository.list(params)

    return {
      classes: result.items,
      meta: toPaginationMeta(result),
    }
  }
}
