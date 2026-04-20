import { PoolsRepository } from '../repositories/pools-repository';

export class DeletePoolUseCase {
  constructor(private readonly poolsRepository: PoolsRepository) {}

  async execute(id: string) {
    const pool = await this.poolsRepository.remove(id);
    return { pool };
  }
}
