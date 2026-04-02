import type { Pool } from '@/domain/pools/enterprise/entities/pool'
import type { CreatePoolRequest, UpdatePoolRequest } from '../dtos/pool-requests'
import type { PaginatedResult, PaginationParams } from '@/domain/shared/pagination/pagination-params'

export interface CreatePoolRepositoryInput extends CreatePoolRequest {}
export interface UpdatePoolRepositoryInput extends UpdatePoolRequest {}
export interface ListPoolsRepositoryParams extends PaginationParams {
  search?: string
  status?: string
}

export abstract class PoolsRepository {
  abstract list(params?: ListPoolsRepositoryParams): Promise<PaginatedResult<Pool>>
  abstract create(input: CreatePoolRepositoryInput): Promise<Pool>
  abstract update(id: string, input: UpdatePoolRepositoryInput): Promise<Pool>
  abstract remove(id: string): Promise<Pool>
}
