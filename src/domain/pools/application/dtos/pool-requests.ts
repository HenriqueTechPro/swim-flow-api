import type { PoolStatus } from '../../enterprise/entities/pool';

export interface CreatePoolRequest {
  name: string;
  lengthMeters: number;
  address: string;
  status: PoolStatus;
  maxCapacity?: number | null;
}

export type UpdatePoolRequest = CreatePoolRequest;
