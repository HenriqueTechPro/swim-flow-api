import type { PoolStatus as PrismaPoolStatus } from '@prisma/client';
import type { Pool } from '@/domain/pools/enterprise/entities/pool';

export interface PrismaPoolRecord {
  id: string;
  name: string;
  lengthMeters: number;
  address: string;
  status: PrismaPoolStatus;
  maxCapacity: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const toDomainStatus = (status: PrismaPoolStatus): Pool['status'] =>
  status === 'Manutencao' ? 'Manutenção' : status;

export class PrismaPoolMapper {
  static toDomain(this: void, pool: PrismaPoolRecord): Pool {
    return {
      id: pool.id,
      name: pool.name,
      lengthMeters: pool.lengthMeters,
      address: pool.address,
      status: toDomainStatus(pool.status),
      maxCapacity: pool.maxCapacity,
      createdAt: pool.createdAt.toISOString(),
      updatedAt: pool.updatedAt.toISOString(),
    };
  }
}
