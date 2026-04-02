import { Injectable } from '@nestjs/common'
import type { CreatePoolRequest } from '../dtos/pool-requests'
import { PoolsRepository } from '../repositories/pools-repository'

@Injectable()
export class CreatePoolUseCase {
  constructor(private readonly poolsRepository: PoolsRepository) {}

  async execute(input: CreatePoolRequest) {
    const pool = await this.poolsRepository.create(input)
    return { pool }
  }
}
