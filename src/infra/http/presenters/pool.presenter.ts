import type { Pool } from '@/domain/pools/enterprise/entities/pool'

export class PoolPresenter {
  static toHTTP(pool: Pool) {
    return {
      id: pool.id,
      name: pool.name,
      length_meters: pool.lengthMeters,
      address: pool.address,
      status: pool.status,
      max_capacity: pool.maxCapacity ?? null,
      created_at: pool.createdAt,
      updated_at: pool.updatedAt,
    }
  }
}
