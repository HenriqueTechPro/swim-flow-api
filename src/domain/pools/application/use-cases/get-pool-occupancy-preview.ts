import { PoolsRepository } from '../repositories/pools-repository';

export class GetPoolOccupancyPreviewUseCase {
  constructor(private readonly pools: PoolsRepository) {}

  execute(poolId: string, date: string) {
    return this.pools.occupancyPreview(poolId, date);
  }
}
