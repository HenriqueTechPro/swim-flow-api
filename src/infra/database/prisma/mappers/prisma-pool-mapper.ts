import type { Pool } from '@/domain/pools/enterprise/entities/pool'

export interface PrismaPoolRecord {
  id: string
  name: string
  lengthMeters: number
  address: string
  status: string
  maxCapacity: number | null
  createdAt: Date
  updatedAt: Date
}

export class PrismaPoolMapper {
  static toDomain(pool: PrismaPoolRecord): Pool {
    return {
      id: pool.id,
      name: pool.name,
      lengthMeters: pool.lengthMeters,
      address: pool.address,
      status: pool.status as Pool['status'],
      maxCapacity: pool.maxCapacity,
      createdAt: pool.createdAt.toISOString(),
      updatedAt: pool.updatedAt.toISOString(),
    }
  }
}
