import type { CreatePoolDto, UpdatePoolDto } from '@/shared/contracts/pools.contracts'
import type { CreatePoolRequest, UpdatePoolRequest } from '@/domain/pools/application/dtos/pool-requests'

export class PoolRequestMapper {
  static toCreate(body: CreatePoolDto): CreatePoolRequest {
    return { ...body }
  }

  static toUpdate(body: UpdatePoolDto): UpdatePoolRequest {
    return { ...body }
  }
}
