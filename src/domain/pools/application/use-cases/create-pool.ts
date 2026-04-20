import type { CreatePoolRequest } from '../dtos/pool-requests';
import { PoolsRepository } from '../repositories/pools-repository';

export class CreatePoolUseCase {
  constructor(private readonly poolsRepository: PoolsRepository) {}

  async execute(input: CreatePoolRequest) {
    const pool = await this.poolsRepository.create(input);
    return { pool };
  }
}
