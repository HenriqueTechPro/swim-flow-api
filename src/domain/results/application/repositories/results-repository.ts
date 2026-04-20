import type { Result } from '@/domain/results/enterprise/entities/result';
import type {
  CreateResultRequest,
  UpdateResultRequest,
} from '../dtos/result-requests';
import type { GenerateRankingRequest } from '../dtos/result-ranking';
import type {
  PaginatedResult,
  PaginationParams,
} from '@/domain/shared/pagination/pagination-params';

export type CreateResultRepositoryInput = CreateResultRequest;
export type UpdateResultRepositoryInput = UpdateResultRequest;
export interface ListResultsRepositoryParams extends PaginationParams {
  search?: string;
  discipline?: string;
  competitionType?: string;
  courseType?: string;
  style?: string;
  eventFormat?: string;
  resultStatus?: string;
  distance?: string;
  customDistance?: string;
  competition?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  studentId?: string;
}

export interface ResultsSummary {
  totalResults: number;
  personalBests: number;
  improvements: number;
  lastMonthResults: number;
  poolResults: number;
  openWaterResults: number;
  disqualifiedResults: number;
}

export interface ResultFilterOptions {
  disciplines: string[];
  styles: string[];
  distances: string[];
  categories: string[];
  competitions: string[];
  eventFormats: string[];
}

export interface ResultCompetitionContext {
  key: string;
  discipline: string;
  competitionType: string;
  courseType: string;
  courseTypeValue: string;
  eventFormat: string;
  style: string;
  distance: string;
  customDistance: string;
  distanceLabel: string;
  category: string;
  label: string;
  subtitle: string;
}

export interface ResultStyleDistributionItem {
  style: string;
  label: string;
  count: number;
}

export interface ResultEvolutionStudentOption {
  studentId: string;
  studentName: string;
  resultCount: number;
}

export interface ResultEvolutionPointValue {
  studentId: string;
  studentName: string;
  bestTimeSeconds: number;
}

export interface ResultEvolutionPoint {
  monthKey: string;
  monthLabel: string;
  values: ResultEvolutionPointValue[];
}

export interface ResultsEvolution {
  students: ResultEvolutionStudentOption[];
  points: ResultEvolutionPoint[];
}

export interface ResultEvolutionParams extends ListResultsRepositoryParams {
  focusStudentId?: string;
  chartStartDate?: string;
  chartEndDate?: string;
}

export abstract class ResultsRepository {
  abstract list(
    params?: ListResultsRepositoryParams,
  ): Promise<PaginatedResult<Result>>;
  abstract summary(
    params?: ListResultsRepositoryParams,
  ): Promise<ResultsSummary>;
  abstract listFilterOptions(): Promise<ResultFilterOptions>;
  abstract listCompetitionContexts(
    params?: ListResultsRepositoryParams,
  ): Promise<ResultCompetitionContext[]>;
  abstract getStyleDistribution(
    params?: ListResultsRepositoryParams,
  ): Promise<ResultStyleDistributionItem[]>;
  abstract getEvolution(
    params?: ResultEvolutionParams,
  ): Promise<ResultsEvolution>;
  abstract listRecordCandidates(
    params?: ListResultsRepositoryParams,
  ): Promise<Result[]>;
  abstract listRankingCandidates(
    input: GenerateRankingRequest,
  ): Promise<Result[]>;
  abstract create(input: CreateResultRepositoryInput): Promise<Result>;
  abstract update(
    id: string,
    input: UpdateResultRepositoryInput,
  ): Promise<Result>;
  abstract remove(id: string): Promise<Result>;
}

