export type PoolStatus = 'Ativa' | 'Inativa' | 'Manutenção';

export interface Pool {
  id: string;
  name: string;
  lengthMeters: number;
  address: string;
  status: PoolStatus;
  maxCapacity?: number | null;
  createdAt: string;
  updatedAt: string;
}
