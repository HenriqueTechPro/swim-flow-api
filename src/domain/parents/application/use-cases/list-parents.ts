import { Injectable } from '@nestjs/common'
import { ParentsRepository, type ListParentsRepositoryParams } from '../repositories/parents-repository'
import { toPaginationMeta } from '@/domain/shared/pagination/pagination-utils'

@Injectable()
export class ListParentsUseCase {
  constructor(private readonly parentsRepository: ParentsRepository) {}

  async execute(params?: ListParentsRepositoryParams) {
    const result = await this.parentsRepository.list(params)
    return {
      parents: result.items,
      meta: toPaginationMeta(result),
    }
  }
}
