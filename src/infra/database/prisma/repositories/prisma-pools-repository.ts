import { Injectable } from '@nestjs/common'
import { CacheRepository } from '@/infra/cache/cache-repository'
import { buildPaginatedCacheKey, rememberPaginatedResult } from '@/infra/cache/cache.helpers'
import { EnvService } from '@/infra/env/env.service'
import { createPaginatedResult, normalizePaginationParams } from '@/domain/shared/pagination/pagination-utils'
import {
  PoolsRepository,
  type CreatePoolRepositoryInput,
  type ListPoolsRepositoryParams,
  type UpdatePoolRepositoryInput,
} from '@/domain/pools/application/repositories/pools-repository'
import { AppError } from '@/shared/errors/app-error'
import { PrismaService } from '../prisma.service'
import { PrismaPoolMapper, type PrismaPoolRecord } from '../mappers/prisma-pool-mapper'

@Injectable()
export class PrismaPoolsRepository implements PoolsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheRepository,
    private readonly env: EnvService,
  ) {}

  async list(params?: ListPoolsRepositoryParams) {
    const { page, perPage } = normalizePaginationParams(params)
    const search = params?.search?.trim()
    const status = params?.status?.trim()
    const cacheKey = `${buildPaginatedCacheKey('pools', page, perPage)}:${search ?? ''}:${status ?? ''}`

    return rememberPaginatedResult(this.cache, cacheKey, this.env.cacheTtlSeconds, async () => {
      const skip = (page - 1) * perPage
      const where = {
        ...(status ? { status: status as never } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { address: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      }

      const [pools, total] = await this.prisma.$transaction([
        this.prisma.pool.findMany({
          where,
          orderBy: { name: 'asc' },
          skip,
          take: perPage,
        }),
        this.prisma.pool.count({ where }),
      ])

      return createPaginatedResult(
        (pools as unknown as PrismaPoolRecord[]).map(PrismaPoolMapper.toDomain),
        total,
        { page, perPage },
      )
    })
  }

  async create(input: CreatePoolRepositoryInput) {
    const pool = await this.prisma.pool.create({
      data: {
        name: input.name,
        lengthMeters: input.lengthMeters,
        address: input.address,
        status: input.status as never,
        maxCapacity: input.maxCapacity ?? null,
      },
    })

    await this.cache.deleteMatching('pools:list:')
    return PrismaPoolMapper.toDomain(pool as unknown as PrismaPoolRecord)
  }

  async update(id: string, input: UpdatePoolRepositoryInput) {
    const existing = await this.prisma.pool.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!existing) {
      throw new AppError(404, 'Pool not found')
    }

    const pool = await this.prisma.pool.update({
      where: { id },
      data: {
        name: input.name,
        lengthMeters: input.lengthMeters,
        address: input.address,
        status: input.status as never,
        maxCapacity: input.maxCapacity ?? null,
      },
    })

    await this.cache.deleteMatching('pools:list:')
    return PrismaPoolMapper.toDomain(pool as unknown as PrismaPoolRecord)
  }

  async remove(id: string) {
    const existing = await this.prisma.pool.findUnique({
      where: { id },
    })

    if (!existing) {
      throw new AppError(404, 'Pool not found')
    }

    await this.prisma.pool.delete({
      where: { id },
    })

    await this.cache.deleteMatching('pools:list:')
    return PrismaPoolMapper.toDomain(existing as unknown as PrismaPoolRecord)
  }
}
