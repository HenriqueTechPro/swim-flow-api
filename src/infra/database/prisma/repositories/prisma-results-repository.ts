import { Injectable } from '@nestjs/common'
import { CacheRepository } from '@/infra/cache/cache-repository'
import { buildPaginatedCacheKey, rememberCachedValue, rememberPaginatedResult } from '@/infra/cache/cache.helpers'
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
import { formatCategoryLabel } from '@/shared/utils/domain-formatters'
import { PrismaService } from '../prisma.service'
import { PrismaResultMapper, type PrismaResultRecord } from '../mappers/prisma-result-mapper'

const resultInclude = {
  student: {
    select: {
      name: true,
    },
  },
}

const RESULT_FILTER_OPTIONS_CACHE_KEY = 'results:options'

const RESULT_DISCIPLINE_TO_PRISMA = {
  Piscina: 'Piscina',
  'Aguas Abertas': 'Aguas_Abertas',
} as const

const RESULT_COURSE_TYPE_TO_PRISMA = {
  'Piscina Curta': 'Piscina_Curta',
  'Piscina Longa': 'Piscina_Longa',
  Mar: 'Mar',
  Rio: 'Rio',
  Lago: 'Lago',
  Represa: 'Represa',
} as const

const RESULT_EVENT_FORMAT_TO_PRISMA = {
  'Prova Individual': 'Prova_Individual',
  Travessia: 'Travessia',
  'Knockout Sprint': 'Knockout_Sprint',
  Revezamento: 'Revezamento',
} as const

const RESULT_STATUS_TO_PRISMA = {
  Classificado: 'Classificado',
  Desclassificado: 'Desclassificado',
} as const

const RESULT_STYLE_TO_PRISMA = {
  Livre: 'Livre',
  Costas: 'Costas',
  Peito: 'Peito',
  Borboleta: 'Borboleta',
  Medley: 'Medley',
} as const

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
    return rememberCachedValue(this.cache, RESULT_FILTER_OPTIONS_CACHE_KEY, this.env.cacheTtlSeconds, async () => {
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
    })
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
        ...(discipline
          ? {
              discipline:
                RESULT_DISCIPLINE_TO_PRISMA[discipline as keyof typeof RESULT_DISCIPLINE_TO_PRISMA],
            }
          : {}),
        ...(style ? { style: RESULT_STYLE_TO_PRISMA[style as keyof typeof RESULT_STYLE_TO_PRISMA] } : {}),
        ...(distance ? { distance } : {}),
        ...(competition ? { competition } : {}),
        ...(competitionType ? { competitionType } : {}),
        ...(courseType
          ? { courseType: RESULT_COURSE_TYPE_TO_PRISMA[courseType as keyof typeof RESULT_COURSE_TYPE_TO_PRISMA] }
          : {}),
        ...(eventFormat
          ? {
              eventFormat:
                RESULT_EVENT_FORMAT_TO_PRISMA[eventFormat as keyof typeof RESULT_EVENT_FORMAT_TO_PRISMA],
            }
          : {}),
        ...(resultStatus
          ? { resultStatus: RESULT_STATUS_TO_PRISMA[resultStatus as keyof typeof RESULT_STATUS_TO_PRISMA] }
          : {}),
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
                { competitionType: { contains: search, mode: 'insensitive' as const } } ,
                { category: { contains: search, mode: 'insensitive' as const } },
                { distance: { contains: search, mode: 'insensitive' as const } },
                { customDistance: { contains: search, mode: 'insensitive' as const } },
                ...(RESULT_DISCIPLINE_TO_PRISMA[search as keyof typeof RESULT_DISCIPLINE_TO_PRISMA]
                  ? [{ discipline: RESULT_DISCIPLINE_TO_PRISMA[search as keyof typeof RESULT_DISCIPLINE_TO_PRISMA] }]
                  : []),
                ...(RESULT_COURSE_TYPE_TO_PRISMA[search as keyof typeof RESULT_COURSE_TYPE_TO_PRISMA]
                  ? [{ courseType: RESULT_COURSE_TYPE_TO_PRISMA[search as keyof typeof RESULT_COURSE_TYPE_TO_PRISMA] }]
                  : []),
                ...(RESULT_EVENT_FORMAT_TO_PRISMA[search as keyof typeof RESULT_EVENT_FORMAT_TO_PRISMA]
                  ? [
                      {
                        eventFormat:
                          RESULT_EVENT_FORMAT_TO_PRISMA[search as keyof typeof RESULT_EVENT_FORMAT_TO_PRISMA],
                      },
                    ]
                  : []),
                ...(RESULT_STATUS_TO_PRISMA[search as keyof typeof RESULT_STATUS_TO_PRISMA]
                  ? [{ resultStatus: RESULT_STATUS_TO_PRISMA[search as keyof typeof RESULT_STATUS_TO_PRISMA] }]
                  : []),
                ...(RESULT_STYLE_TO_PRISMA[search as keyof typeof RESULT_STYLE_TO_PRISMA]
                  ? [{ style: RESULT_STYLE_TO_PRISMA[search as keyof typeof RESULT_STYLE_TO_PRISMA] }]
                  : []),
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
      select: {
        id: true,
        category: {
          select: { name: true },
        },
      },
    })

    if (!student) {
      throw new AppError(404, 'Student not found')
    }

    const result = await this.prisma.result.create({
      data: {
        studentId: input.studentId,
        discipline:
          RESULT_DISCIPLINE_TO_PRISMA[(input.discipline || 'Piscina') as keyof typeof RESULT_DISCIPLINE_TO_PRISMA],
        style: RESULT_STYLE_TO_PRISMA[input.style as keyof typeof RESULT_STYLE_TO_PRISMA],
        distance: input.distance,
        customDistance: input.customDistance || '',
        competitionType: input.competitionType || '',
        courseType:
          RESULT_COURSE_TYPE_TO_PRISMA[(input.courseType || 'Piscina Curta') as keyof typeof RESULT_COURSE_TYPE_TO_PRISMA],
        eventFormat:
          RESULT_EVENT_FORMAT_TO_PRISMA[
            (input.eventFormat || 'Prova Individual') as keyof typeof RESULT_EVENT_FORMAT_TO_PRISMA
          ],
        time: input.time,
        timeInSeconds: timeToSeconds(input.time),
        date: new Date(input.date),
        competition: input.competition || '',
        position: input.position ?? 0,
        resultStatus:
          RESULT_STATUS_TO_PRISMA[(input.resultStatus || 'Classificado') as keyof typeof RESULT_STATUS_TO_PRISMA],
        personalBest: false,
        improvement: 0,
        category: input.category || (student.category ? formatCategoryLabel(student.category.name) : ''),
        notes: input.notes || null,
      },
      include: resultInclude,
    })

    await this.cache.deleteMatching('results:list:')
    await this.cache.delete(RESULT_FILTER_OPTIONS_CACHE_KEY)
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
        discipline:
          RESULT_DISCIPLINE_TO_PRISMA[(input.discipline || 'Piscina') as keyof typeof RESULT_DISCIPLINE_TO_PRISMA],
        style: RESULT_STYLE_TO_PRISMA[input.style as keyof typeof RESULT_STYLE_TO_PRISMA],
        distance: input.distance,
        customDistance: input.customDistance || '',
        competitionType: input.competitionType || '',
        courseType:
          RESULT_COURSE_TYPE_TO_PRISMA[(input.courseType || 'Piscina Curta') as keyof typeof RESULT_COURSE_TYPE_TO_PRISMA],
        eventFormat:
          RESULT_EVENT_FORMAT_TO_PRISMA[
            (input.eventFormat || 'Prova Individual') as keyof typeof RESULT_EVENT_FORMAT_TO_PRISMA
          ],
        time: input.time,
        timeInSeconds: input.timeInSeconds,
        date: new Date(input.date),
        competition: input.competition || '',
        position: input.position ?? 0,
        resultStatus:
          RESULT_STATUS_TO_PRISMA[(input.resultStatus || 'Classificado') as keyof typeof RESULT_STATUS_TO_PRISMA],
        personalBest: input.personalBest,
        improvement: input.improvement,
        category: input.category || '',
        notes: input.notes || null,
      },
      include: resultInclude,
    })

    await this.cache.deleteMatching('results:list:')
    await this.cache.delete(RESULT_FILTER_OPTIONS_CACHE_KEY)
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
    await this.cache.delete(RESULT_FILTER_OPTIONS_CACHE_KEY)
    return PrismaResultMapper.toDomain(existing as unknown as PrismaResultRecord)
  }
}
