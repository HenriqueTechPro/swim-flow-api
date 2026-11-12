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
    options: Array<{ id: string; title: string; date: string | null; disciplines: Array<'Piscina' | 'Aguas Abertas'> }>;
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

/**
 * Three distinct notions of season membership. Counts refer to unique students,
 * NOT records or an inferred cohort. Competitive groups can overlap.
 */
export interface StudentSeasonComposition {
  season: ResultSeasonOption;
  categoriesRegistered: number;
  participants: {
    distinct: number;
    pool: number;
    openWater: number;
  };
  enrolledDuringPeriod: number;
}

export interface CategoryRolloverPreviewRow {
  studentId: string;
  studentName: string;
  studentStatus: string;
  sourceCategory: { id: string; name: string };
  suggestedCategory: { id: string; name: string } | null;
  existingTargetCategory: { id: string; name: string } | null;
  warnings: Array<
    | 'MISSING_BIRTH_DATE'
    | 'INVALID_BIRTH_YEAR'
    | 'CATEGORY_NOT_IN_CATALOG'
    | 'TARGET_ALREADY_ASSIGNED'
    | 'TARGET_HAS_RESULTS'
    | 'SENIOR_MASTER_REVIEW'
  >;
}

export interface CategoryRolloverPreview {
  source: ResultSeasonOption;
  target: ResultSeasonOption;
  items: CategoryRolloverPreviewRow[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
  readOnly: true;
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

  abstract studentComposition(id: string): Promise<StudentSeasonComposition>;

  abstract categoryRolloverPreview(
    id: string,
    params: { page: number; perPage: number },
  ): Promise<CategoryRolloverPreview>;

  abstract create(input: WriteResultSeasonInput): Promise<ResultSeasonOption>;

  abstract update(
    id: string,
    input: WriteResultSeasonInput,
  ): Promise<ResultSeasonOption>;
}
