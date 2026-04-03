import { Injectable } from '@nestjs/common'
import { CacheRepository } from '@/infra/cache/cache-repository'
import { buildPaginatedCacheKey, rememberPaginatedResult } from '@/infra/cache/cache.helpers'
import { EnvService } from '@/infra/env/env.service'
import { createPaginatedResult, normalizePaginationParams } from '@/domain/shared/pagination/pagination-utils'
import {
  ResultsRepository,
  type CreateResultRepositoryInput,
  type ListResultsRepositoryParams,
  type ResultFilterOptions,
  type UpdateResultRepositoryInput,
} from '@/domain/results/application/repositories/results-repository'
import { AppError } from '@/shared/errors/app-error'
import { PrismaService } from '../prisma.service'
import { PrismaResultMapper, type PrismaResultRecord } from '../mappers/prisma-result-mapper'

const resultInclude = {
  student: {
    select: {
      name: true,
    },
  },
}

const timeToSeconds = (time: string) => {
  const parts = time.split(':')
  if (parts.length === 2) {
    const [minutes, seconds] = parts
    return parseInt(minutes, 10) * 60 + parseFloat(seconds)
  }
  return parseFloat(time)
}

@Injectable()
export class PrismaResultsRepository implements ResultsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheRepository,
    private readonly env: EnvService,
  ) {}

  async getFilterOptions(): Promise<ResultFilterOptions> {
    const [
      disciplines,
      styles,
      distances,
      competitions,
      eventFormats,
      categories,
    ] = await this.prisma.$transaction([
      this.prisma.result.findMany({ distinct: ['discipline'], select: { discipline: true } }),
      this.prisma.result.findMany({ distinct: ['style'], select: { style: true } }),
      this.prisma.result.findMany({ distinct: ['distance'], select: { distance: true } }),
      this.prisma.result.findMany({ distinct: ['competition'], select: { competition: true } }),
      this.prisma.result.findMany({ distinct: ['eventFormat'], select: { eventFormat: true } }),
      this.prisma.result.findMany({ distinct: ['category'], select: { category: true } }),
    ])

    const unique = (values: string[]) =>
      [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right, 'pt-BR'))

    return {
      disciplines: unique(disciplines.map((item) => item.discipline || 'Piscina')),
      styles: unique(styles.map((item) => item.style)),
      distances: unique(distances.map((item) => item.distance)),
      competitions: unique(competitions.map((item) => item.competition)),
      eventFormats: unique(eventFormats.map((item) => item.eventFormat || 'Prova Individual')),
      categories: unique(categories.map((item) => item.category)),
    }
  }

  async list(params?: ListResultsRepositoryParams) {
    const { page, perPage } = normalizePaginationParams(params)
    const search = params?.search?.trim()
    const discipline = params?.discipline?.trim()
    const style = params?.style?.trim()
    const distance = params?.distance?.trim()
    const competition = params?.competition?.trim()
    const competitionType = params?.competitionType?.trim()
    const courseType = params?.courseType?.trim()
    const eventFormat = params?.eventFormat?.trim()
    const resultStatus = params?.resultStatus?.trim()
    const category = params?.category?.trim()
    const startDate = params?.startDate?.trim()
    const endDate = params?.endDate?.trim()
    const studentId = params?.studentId?.trim()
    const cacheKey = `${buildPaginatedCacheKey('results', page, perPage)}:${search ?? ''}:${discipline ?? ''}:${style ?? ''}:${distance ?? ''}:${competition ?? ''}:${competitionType ?? ''}:${courseType ?? ''}:${eventFormat ?? ''}:${resultStatus ?? ''}:${category ?? ''}:${startDate ?? ''}:${endDate ?? ''}:${studentId ?? ''}`

    return rememberPaginatedResult(this.cache, cacheKey, this.env.cacheTtlSeconds, async () => {
      const skip = (page - 1) * perPage
      const where = {
        ...(discipline ? { discipline } : {}),
        ...(style ? { style } : {}),
        ...(distance ? { distance } : {}),
        ...(competition ? { competition } : {}),
        ...(competitionType ? { competitionType } : {}),
        ...(courseType ? { courseType } : {}),
        ...(eventFormat ? { eventFormat } : {}),
        ...(resultStatus ? { resultStatus } : {}),
        ...(category ? { category } : {}),
        ...(studentId ? { studentId } : {}),
        ...(startDate || endDate
          ? {
              date: {
                ...(startDate ? { gte: new Date(startDate) } : {}),
                ...(endDate ? { lte: new Date(endDate) } : {}),
              },
            }
          : {}),
        ...(search
          ? {
              OR: [
                { student: { name: { contains: search, mode: 'insensitive' as const } } },
                { competition: { contains: search, mode: 'insensitive' as const } },
                { discipline: { contains: search, mode: 'insensitive' as const } },
                { competitionType: { contains: search, mode: 'insensitive' as const } } ,
                { courseType: { contains: search, mode: 'insensitive' as const } },
                { eventFormat: { contains: search, mode: 'insensitive' as const } },
                { resultStatus: { contains: search, mode: 'insensitive' as const } },
                { category: { contains: search, mode: 'insensitive' as const } },
                { style: { contains: search, mode: 'insensitive' as const } },
                { distance: { contains: search, mode: 'insensitive' as const } },
                { customDistance: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      }

      const [results, total] = await this.prisma.$transaction([
        this.prisma.result.findMany({
          where,
          include: resultInclude,
          orderBy: { date: 'desc' },
          skip,
          take: perPage,
        }),
        this.prisma.result.count({ where }),
      ])

      return createPaginatedResult(
        (results as unknown as PrismaResultRecord[]).map(PrismaResultMapper.toDomain),
        total,
        { page, perPage },
      )
    })
  }

  async create(input: CreateResultRepositoryInput) {
    const student = await this.prisma.student.findUnique({
      where: { id: input.studentId },
      select: { id: true, categoryLabel: true },
    })

    if (!student) {
      throw new AppError(404, 'Student not found')
    }

    const result = await this.prisma.result.create({
      data: {
        studentId: input.studentId,
        discipline: input.discipline || 'Piscina',
        style: input.style,
        distance: input.distance,
        customDistance: input.customDistance || '',
        competitionType: input.competitionType || '',
        courseType: input.courseType || '',
        eventFormat: input.eventFormat || 'Prova Individual',
        time: input.time,
        timeInSeconds: timeToSeconds(input.time),
        date: new Date(input.date),
        competition: input.competition || '',
        position: input.position ?? 0,
        resultStatus: input.resultStatus || 'Classificado',
        personalBest: false,
        improvement: 0,
        category: input.category || student.categoryLabel || '',
        notes: input.notes || null,
      },
      include: resultInclude,
    })

    await this.cache.deleteMatching('results:list:')
    return PrismaResultMapper.toDomain(result as unknown as PrismaResultRecord)
  }

  async update(id: string, input: UpdateResultRepositoryInput) {
    const existing = await this.prisma.result.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!existing) {
      throw new AppError(404, 'Result not found')
    }

    const result = await this.prisma.result.update({
      where: { id },
      data: {
        studentId: input.studentId,
        discipline: input.discipline || 'Piscina',
        style: input.style,
        distance: input.distance,
        customDistance: input.customDistance || '',
        competitionType: input.competitionType || '',
        courseType: input.courseType || '',
        eventFormat: input.eventFormat || 'Prova Individual',
        time: input.time,
        timeInSeconds: input.timeInSeconds,
        date: new Date(input.date),
        competition: input.competition || '',
        position: input.position ?? 0,
        resultStatus: input.resultStatus || 'Classificado',
        personalBest: input.personalBest,
        improvement: input.improvement,
        category: input.category || '',
        notes: input.notes || null,
      },
      include: resultInclude,
    })

    await this.cache.deleteMatching('results:list:')
    return PrismaResultMapper.toDomain(result as unknown as PrismaResultRecord)
  }

  async remove(id: string) {
    const existing = await this.prisma.result.findUnique({
      where: { id },
      include: resultInclude,
    })

    if (!existing) {
      throw new AppError(404, 'Result not found')
    }

    await this.prisma.result.delete({
      where: { id },
    })

    await this.cache.deleteMatching('results:list:')
    return PrismaResultMapper.toDomain(existing as unknown as PrismaResultRecord)
  }
}
