import { Injectable } from '@nestjs/common'
import { CacheRepository } from '@/infra/cache/cache-repository'
import { buildPaginatedCacheKey, rememberPaginatedResult } from '@/infra/cache/cache.helpers'
import { EnvService } from '@/infra/env/env.service'
import { createPaginatedResult, normalizePaginationParams } from '@/domain/shared/pagination/pagination-utils'
import {
  EventsRepository,
  type CreateEventRepositoryInput,
  type ListEventsRepositoryParams,
  type UpdateEventRepositoryInput,
} from '@/domain/events/application/repositories/events-repository'
import { AppError } from '@/shared/errors/app-error'
import { PrismaService } from '../prisma.service'
import { PrismaEventMapper, type PrismaEventRecord } from '../mappers/prisma-event-mapper'

const EVENT_TYPE_TO_PRISMA = {
  'Competição': 'Competicao',
  'Reunião': 'Reuniao',
  Festival: 'Festival',
  Outro: 'Outro',
} as const

const EVENT_STATUS_TO_PRISMA = {
  Agendado: 'Agendado',
  'Em Andamento': 'Em_Andamento',
  'Concluído': 'Concluido',
  Cancelado: 'Cancelado',
} as const

const toTimeDate = (value: string) => new Date(`1970-01-01T${value}:00.000Z`)

@Injectable()
export class PrismaEventsRepository implements EventsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheRepository,
    private readonly env: EnvService,
  ) {}

  async list(params?: ListEventsRepositoryParams) {
    const { page, perPage } = normalizePaginationParams(params)
    const search = params?.search?.trim()
    const type = params?.type?.trim()
    const status = params?.status?.trim()
    const cacheKey = `${buildPaginatedCacheKey('events', page, perPage)}:${search ?? ''}:${type ?? ''}:${status ?? ''}`

    return rememberPaginatedResult(this.cache, cacheKey, this.env.cacheTtlSeconds, async () => {
      const skip = (page - 1) * perPage
      const where = {
        ...(type ? { type: EVENT_TYPE_TO_PRISMA[type as keyof typeof EVENT_TYPE_TO_PRISMA] } : {}),
        ...(status ? { status: EVENT_STATUS_TO_PRISMA[status as keyof typeof EVENT_STATUS_TO_PRISMA] } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' as const } },
                { location: { contains: search, mode: 'insensitive' as const } },
                { description: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      }

      const [events, total] = await this.prisma.$transaction([
        this.prisma.event.findMany({
          where,
          orderBy: { date: 'asc' },
          skip,
          take: perPage,
        }),
        this.prisma.event.count({ where }),
      ])

      return createPaginatedResult(
        (events as unknown as PrismaEventRecord[]).map(PrismaEventMapper.toDomain),
        total,
        { page, perPage },
      )
    })
  }

  async create(input: CreateEventRepositoryInput) {
    const event = await this.prisma.event.create({
      data: {
        title: input.title,
        description: input.description || '',
        type: EVENT_TYPE_TO_PRISMA[input.type],
        date: new Date(input.date),
        startTime: toTimeDate(input.startTime),
        endTime: toTimeDate(input.endTime),
        location: input.location,
        status: EVENT_STATUS_TO_PRISMA[input.status],
      },
    })

    await this.cache.deleteMatching('events:list:')
    return PrismaEventMapper.toDomain(event as unknown as PrismaEventRecord)
  }

  async update(id: string, input: UpdateEventRepositoryInput) {
    const existing = await this.prisma.event.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!existing) {
      throw new AppError(404, 'Event not found')
    }

    const event = await this.prisma.event.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description || '',
        type: EVENT_TYPE_TO_PRISMA[input.type],
        date: new Date(input.date),
        startTime: toTimeDate(input.startTime),
        endTime: toTimeDate(input.endTime),
        location: input.location,
        status: EVENT_STATUS_TO_PRISMA[input.status],
      },
    })

    await this.cache.deleteMatching('events:list:')
    return PrismaEventMapper.toDomain(event as unknown as PrismaEventRecord)
  }

  async remove(id: string) {
    const existing = await this.prisma.event.findUnique({
      where: { id },
    })

    if (!existing) {
      throw new AppError(404, 'Event not found')
    }

    await this.prisma.event.delete({
      where: { id },
    })

    await this.cache.deleteMatching('events:list:')
    return PrismaEventMapper.toDomain(existing as unknown as PrismaEventRecord)
  }
}
