import type { PaginationParams, PaginatedResult } from '@/domain/shared/pagination/pagination-params';

export type ResultSeasonStatus = 'PLANNED' | 'ACTIVE' | 'CLOSED';

export interface ResultSeasonOption {
  id: string;
  year: number;
  label: string;
  startsOn: string;
  endsOn: string;
  status: ResultSeasonStatus;
}

/** A read-only contract for seasons that can be linked to results. */
export abstract class ResultSeasonsRepository {
  abstract list(
    params?: PaginationParams,
  ): Promise<PaginatedResult<ResultSeasonOption>>;
}
