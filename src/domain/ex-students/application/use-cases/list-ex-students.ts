import { Injectable } from '@nestjs/common'
import { ExStudentsRepository } from '../repositories/ex-students-repository'
import type { ListExStudentsRepositoryParams } from '../repositories/ex-students-repository'
import { toPaginationMeta } from '@/domain/shared/pagination/pagination-utils'

@Injectable()
export class ListExStudentsUseCase {
  constructor(private readonly exStudentsRepository: ExStudentsRepository) {}

  async execute(params?: ListExStudentsRepositoryParams) {
    const result = await this.exStudentsRepository.list(params)
    return {
      exStudents: result.items,
      meta: toPaginationMeta(result),
    }
  }
}
