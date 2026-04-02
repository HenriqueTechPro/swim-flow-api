import { Injectable } from '@nestjs/common'
import { StudentsRepository, type ListStudentsRepositoryParams } from '../repositories/students-repository'
import { toPaginationMeta } from '@/domain/shared/pagination/pagination-utils'

@Injectable()
export class ListStudentsUseCase {
  constructor(private readonly studentsRepository: StudentsRepository) {}

  async execute(params?: ListStudentsRepositoryParams) {
    const result = await this.studentsRepository.list(params)

    return {
      students: result.items,
      meta: toPaginationMeta(result),
    }
  }
}
