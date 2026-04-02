import { Injectable } from '@nestjs/common'
import { TeachersRepository, type ListTeachersRepositoryParams } from '../repositories/teachers-repository'
import { toPaginationMeta } from '@/domain/shared/pagination/pagination-utils'

@Injectable()
export class ListTeachersUseCase {
  constructor(private readonly teachersRepository: TeachersRepository) {}

  async execute(params?: ListTeachersRepositoryParams) {
    const result = await this.teachersRepository.list(params)

    return {
      teachers: result.items,
      meta: toPaginationMeta(result),
    }
  }
}
