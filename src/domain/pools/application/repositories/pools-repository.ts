import type { Pool } from '@/domain/pools/enterprise/entities/pool';
import type {
  CreatePoolRequest,
  UpdatePoolRequest,
} from '../dtos/pool-requests';
import type {
  PaginatedResult,
  PaginationParams,
} from '@/domain/shared/pagination/pagination-params';

export type CreatePoolRepositoryInput = CreatePoolRequest;
export type UpdatePoolRepositoryInput = UpdatePoolRequest;
export interface ListPoolsRepositoryParams extends PaginationParams {
  search?: string;
  status?: string;
}

export interface PoolOccupancySlot {
  startTime: string;
  endTime: string;
  uniqueStudents: number;
  plannedPercent: number | null;
  classes: Array<{ id: string; name: string; students: number }>;
  overlappingEnrollmentCount: number;
}

export interface PoolOccupancyPreview {
  pool: { id: string; name: string; capacity: number | null };
  date: string;
  weekday: string;
  measurement: 'PLANNED_ENROLLMENT';
  limits: {
    recurringScheduleOnly: true;
    excludesTrainings: true;
    excludesAttendance: true;
    noCrossClassDoubleCounting: true;
  };
  slots: PoolOccupancySlot[];
  trainingsNotCounted: Array<{
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    declaredParticipants: number;
  }>;
}

export abstract class PoolsRepository {
  abstract occupancyPreview(id: string, date: string): Promise<PoolOccupancyPreview>;
  abstract list(
    params?: ListPoolsRepositoryParams,
  ): Promise<PaginatedResult<Pool>>;
  abstract create(input: CreatePoolRepositoryInput): Promise<Pool>;
  abstract update(id: string, input: UpdatePoolRepositoryInput): Promise<Pool>;
  abstract remove(id: string): Promise<Pool>;
}
