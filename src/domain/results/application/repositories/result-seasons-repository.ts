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

export interface ResultSeasonOverviewFilters {
  discipline?: 'all' | 'Piscina' | 'Aguas Abertas';
  eventId?: string;
  category?: string;
  studentSearch?: string;
}

export interface ResultSeasonOverview {
  season: ResultSeasonOption;
  filters: Required<Pick<ResultSeasonOverviewFilters, 'discipline'>> &
    Omit<ResultSeasonOverviewFilters, 'discipline'>;
  events: {
    linked: number;
    withoutSeasonInPeriod: number;
    options: Array<{ id: string; title: string; date: string | null }>;
    optionsTruncated: boolean;
  };
  races: { pool: number; openWater: number };
  results: {
    pool: number;
    openWater: number;
    poolWithoutSeasonInPeriod: number;
    openWaterWithoutSeasonInPeriod: number;
  };
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

  abstract overview(
    id: string,
    filters: ResultSeasonOverviewFilters,
  ): Promise<ResultSeasonOverview>;

  abstract create(input: WriteResultSeasonInput): Promise<ResultSeasonOption>;

  abstract update(
    id: string,
    input: WriteResultSeasonInput,
  ): Promise<ResultSeasonOption>;
}
