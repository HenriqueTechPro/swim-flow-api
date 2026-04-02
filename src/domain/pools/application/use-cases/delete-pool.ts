import { Injectable } from '@nestjs/common'
import { PoolsRepository } from '../repositories/pools-repository'

@Injectable()
export class DeletePoolUseCase {
  constructor(private readonly poolsRepository: PoolsRepository) {}

  async execute(id: string) {
    const pool = await this.poolsRepository.remove(id)
    return { pool }
  }
}
