import { Injectable } from '@nestjs/common'
import { PoolsRepository, type ListPoolsRepositoryParams } from '../repositories/pools-repository'
import { toPaginationMeta } from '@/domain/shared/pagination/pagination-utils'

@Injectable()
export class ListPoolsUseCase {
  constructor(private readonly poolsRepository: PoolsRepository) {}

  async execute(params?: ListPoolsRepositoryParams) {
    const result = await this.poolsRepository.list(params)
    return {
      pools: result.items,
      meta: toPaginationMeta(result),
    }
  }
}
