import type { Result } from '@/domain/results/enterprise/entities/result'
import type { CreateResultRequest, UpdateResultRequest } from '../dtos/result-requests'
import type { PaginatedResult, PaginationParams } from '@/domain/shared/pagination/pagination-params'

export interface CreateResultRepositoryInput extends CreateResultRequest {}
export interface UpdateResultRepositoryInput extends UpdateResultRequest {}
export interface ListResultsRepositoryParams extends PaginationParams {
  search?: string
  discipline?: string
  style?: string
  distance?: string
  competition?: string
  competitionType?: string
  courseType?: string
  eventFormat?: string
  resultStatus?: 'Classificado' | 'Desclassificado'
  category?: string
  startDate?: string
  endDate?: string
  studentId?: string
}

export abstract class ResultsRepository {
  abstract list(params?: ListResultsRepositoryParams): Promise<PaginatedResult<Result>>
  abstract create(input: CreateResultRepositoryInput): Promise<Result>
  abstract update(id: string, input: UpdateResultRepositoryInput): Promise<Result>
  abstract remove(id: string): Promise<Result>
}
