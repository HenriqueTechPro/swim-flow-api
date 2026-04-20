import type { Training } from '@/domain/trainings/enterprise/entities/training';
import type {
  CreateTrainingRequest,
  UpdateTrainingRequest,
} from '../dtos/training-requests';
import type {
  PaginatedResult,
  PaginationParams,
} from '@/domain/shared/pagination/pagination-params';

export type CreateTrainingRepositoryInput = CreateTrainingRequest;
export type UpdateTrainingRepositoryInput = UpdateTrainingRequest;
export interface ListTrainingsRepositoryParams extends PaginationParams {
  search?: string;
  type?: string;
  status?: string;
  poolId?: string;
}

export abstract class TrainingsRepository {
  abstract list(
    params?: ListTrainingsRepositoryParams,
  ): Promise<PaginatedResult<Training>>;
  abstract create(input: CreateTrainingRepositoryInput): Promise<Training>;
  abstract update(
    id: string,
    input: UpdateTrainingRepositoryInput,
  ): Promise<Training>;
  abstract remove(id: string): Promise<Training>;
}
