import { AppError } from '@/shared/errors/app-error'
import type {
  CreatePoolRepositoryInput,
  ListPoolsRepositoryParams,
  UpdatePoolRepositoryInput,
} from '@/domain/pools/application/repositories/pools-repository'
import { PoolsRepository } from '@/domain/pools/application/repositories/pools-repository'
import type { Pool } from '@/domain/pools/enterprise/entities/pool'
import { paginateItems } from '@/domain/shared/pagination/pagination-utils'
import { makePool } from '../factories/make-pool'

export class InMemoryPoolsRepository implements PoolsRepository {
  public items: Pool[] = []

  async list(params?: ListPoolsRepositoryParams) {
    const search = params?.search?.trim().toLowerCase()
    const status = params?.status?.trim()

    const filteredItems = this.items.filter((item) => {
      const matchesSearch =
        !search ||
        item.name.toLowerCase().includes(search) ||
        item.address.toLowerCase().includes(search)
      const matchesStatus = !status || item.status === status

      return matchesSearch && matchesStatus
    })

    return paginateItems(filteredItems, params)
  }

  async create(input: CreatePoolRepositoryInput): Promise<Pool> {
    const pool = makePool({
      name: input.name,
      lengthMeters: input.lengthMeters,
      address: input.address,
      status: input.status,
      maxCapacity: input.maxCapacity ?? null,
    })
    this.items.push(pool)
    return pool
  }

  async update(id: string, input: UpdatePoolRepositoryInput): Promise<Pool> {
    const itemIndex = this.items.findIndex((item) => item.id === id)
    if (itemIndex < 0) throw new AppError(404, 'Pool not found')

    const updatedPool: Pool = {
      ...this.items[itemIndex],
      name: input.name,
      lengthMeters: input.lengthMeters,
      address: input.address,
      status: input.status,
      maxCapacity: input.maxCapacity ?? null,
      updatedAt: '2026-04-01T00:00:00.000Z',
    }

    this.items[itemIndex] = updatedPool
    return updatedPool
  }

  async remove(id: string): Promise<Pool> {
    const itemIndex = this.items.findIndex((item) => item.id === id)
    if (itemIndex < 0) throw new AppError(404, 'Pool not found')

    const [removedPool] = this.items.splice(itemIndex, 1)
    return removedPool
  }
}
