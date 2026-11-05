import type {
  PaginatedResult,
  PaginationParams,
} from '@/domain/shared/pagination/pagination-params';

export type ResultSeasonStatus = 'PLANNED' | 'ACTIVE' | 'CLOSED';

export interface ResultSeasonOption {
  id: string;
  year: number;
  label: string;
  startsOn: string;
  endsOn: string;
  status: ResultSeasonStatus;
}

export interface WriteResultSeasonInput {
  year: number;
  label: string;
  startsOn: string;
  endsOn: string;
  status: ResultSeasonStatus;
}

/** Manages real season reference data without modifying any results. */
export abstract class ResultSeasonsRepository {
  abstract list(
    params?: PaginationParams,
  ): Promise<PaginatedResult<ResultSeasonOption>>;

  abstract create(input: WriteResultSeasonInput): Promise<ResultSeasonOption>;

  abstract update(
    id: string,
    input: WriteResultSeasonInput,
  ): Promise<ResultSeasonOption>;
}
