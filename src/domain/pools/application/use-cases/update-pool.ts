import { Injectable } from '@nestjs/common'
import type { UpdatePoolRequest } from '../dtos/pool-requests'
import { PoolsRepository } from '../repositories/pools-repository'

@Injectable()
export class UpdatePoolUseCase {
  constructor(private readonly poolsRepository: PoolsRepository) {}

  async execute(id: string, input: UpdatePoolRequest) {
    const pool = await this.poolsRepository.update(id, input)
    return { pool }
  }
}
