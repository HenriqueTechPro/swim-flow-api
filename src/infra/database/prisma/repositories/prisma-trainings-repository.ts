import { Injectable } from '@nestjs/common'
import { CacheRepository } from '@/infra/cache/cache-repository'
import { buildPaginatedCacheKey, rememberPaginatedResult } from '@/infra/cache/cache.helpers'
import { EnvService } from '@/infra/env/env.service'
import { createPaginatedResult, normalizePaginationParams } from '@/domain/shared/pagination/pagination-utils'
import {
  TrainingsRepository,
  type CreateTrainingRepositoryInput,
  type ListTrainingsRepositoryParams,
  type UpdateTrainingRepositoryInput,
} from '@/domain/trainings/application/repositories/trainings-repository'
import { AppError } from '@/shared/errors/app-error'
import { PrismaService } from '../prisma.service'
import { PrismaTrainingMapper, type PrismaTrainingRecord } from '../mappers/prisma-training-mapper'

const TRAINING_TYPE_TO_PRISMA = {
  'Técnico': 'Tecnico',
  'Resistência': 'Resistencia',
  Velocidade: 'Velocidade',
  Misto: 'Misto',
} as const

const TRAINING_LEVEL_TO_PRISMA = {
  Iniciante: 'Iniciante',
  'Intermediário': 'Intermediario',
  'Avançado': 'Avancado',
  Todos: 'Todos',
} as const

const TRAINING_DAY_TO_PRISMA = {
  'Segunda-feira': 'Segunda_feira',
  'Terça-feira': 'Terca_feira',
  'Quarta-feira': 'Quarta_feira',
  'Quinta-feira': 'Quinta_feira',
  'Sexta-feira': 'Sexta_feira',
  Sábado: 'Sabado',
  Domingo: 'Domingo',
} as const

const TRAINING_VENUE_TO_PRISMA = {
  Piscina: 'Piscina',
  Mar: 'Mar',
  Rio: 'Rio',
  Lago: 'Lago',
  Represa: 'Represa',
  Outro: 'Outro',
} as const

const SEARCH_TO_VENUE_TYPE = Object.fromEntries(
  Object.entries(TRAINING_VENUE_TO_PRISMA).map(([label, value]) => [label.toLowerCase(), value]),
) as Record<string, (typeof TRAINING_VENUE_TO_PRISMA)[keyof typeof TRAINING_VENUE_TO_PRISMA]>

const toTimeDate = (value: string) => new Date(`1970-01-01T${value}:00.000Z`)

const trainingInclude = {
  instructor: {
    select: { name: true },
  },
  pool: {
    select: { name: true, lengthMeters: true },
  },
  enrollments: {
    include: {
      student: {
        include: {
          category: { select: { name: true } },
          level: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  _count: {
    select: { enrollments: true },
  },
}

@Injectable()
export class PrismaTrainingsRepository implements TrainingsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheRepository,
    private readonly env: EnvService,
  ) {}

  async list(params?: ListTrainingsRepositoryParams) {
    const { page, perPage } = normalizePaginationParams(params)
    const search = params?.search?.trim()
    const type = params?.type?.trim()
    const status = params?.status?.trim()
    const poolId = params?.poolId?.trim()
    const cacheKey = `${buildPaginatedCacheKey('trainings', page, perPage)}:${search ?? ''}:${type ?? ''}:${status ?? ''}:${poolId ?? ''}`

    return rememberPaginatedResult(this.cache, cacheKey, this.env.cacheTtlSeconds, async () => {
      const skip = (page - 1) * perPage
      const where = {
        ...(type ? { type: TRAINING_TYPE_TO_PRISMA[type as keyof typeof TRAINING_TYPE_TO_PRISMA] } : {}),
        ...(status ? { status: status as never } : {}),
        ...(poolId ? { poolId } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' as const } },
                { description: { contains: search, mode: 'insensitive' as const } },
                { locationName: { contains: search, mode: 'insensitive' as const } },
                { instructor: { name: { contains: search, mode: 'insensitive' as const } } },
                { pool: { name: { contains: search, mode: 'insensitive' as const } } },
                ...(SEARCH_TO_VENUE_TYPE[search.toLowerCase()]
                  ? [{ venueType: SEARCH_TO_VENUE_TYPE[search.toLowerCase()] }]
                  : []),
              ],
            }
          : {}),
      }

      const [trainings, total] = await this.prisma.$transaction([
        this.prisma.training.findMany({
          where,
          include: trainingInclude,
          orderBy: { dayOfWeek: 'asc' },
          skip,
          take: perPage,
        }),
        this.prisma.training.count({ where }),
      ])

      return createPaginatedResult(
        (trainings as unknown as PrismaTrainingRecord[]).map(PrismaTrainingMapper.toDomain),
        total,
        { page, perPage },
      )
    })
  }

  async create(input: CreateTrainingRepositoryInput) {
    const training = await this.prisma.training.create({
      data: {
        title: input.title,
        description: input.description || '',
        type: TRAINING_TYPE_TO_PRISMA[input.type],
        dayOfWeek: TRAINING_DAY_TO_PRISMA[input.dayOfWeek],
        startTime: toTimeDate(input.startTime),
        endTime: toTimeDate(input.endTime),
        instructorId: input.instructorId || null,
        level: TRAINING_LEVEL_TO_PRISMA[input.level],
        maxParticipants: input.maxParticipants,
        currentParticipants: input.currentParticipants ?? 0,
        status: input.status as never,
        venueType: TRAINING_VENUE_TO_PRISMA[input.venueType],
        locationName: input.venueType === 'Piscina' ? '' : input.locationName?.trim() || '',
        poolId: input.venueType === 'Piscina' ? input.poolId || null : null,
      },
      include: trainingInclude,
    })

    await this.cache.deleteMatching('trainings:list:')
    return PrismaTrainingMapper.toDomain(training as unknown as PrismaTrainingRecord)
  }

  async update(id: string, input: UpdateTrainingRepositoryInput) {
    const existing = await this.prisma.training.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!existing) {
      throw new AppError(404, 'Training not found')
    }

    const training = await this.prisma.training.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description || '',
        type: TRAINING_TYPE_TO_PRISMA[input.type],
        dayOfWeek: TRAINING_DAY_TO_PRISMA[input.dayOfWeek],
        startTime: toTimeDate(input.startTime),
        endTime: toTimeDate(input.endTime),
        instructorId: input.instructorId || null,
        level: TRAINING_LEVEL_TO_PRISMA[input.level],
        maxParticipants: input.maxParticipants,
        ...(input.currentParticipants !== undefined ? { currentParticipants: input.currentParticipants } : {}),
        status: input.status as never,
        venueType: TRAINING_VENUE_TO_PRISMA[input.venueType],
        locationName: input.venueType === 'Piscina' ? '' : input.locationName?.trim() || '',
        poolId: input.venueType === 'Piscina' ? input.poolId || null : null,
      },
      include: trainingInclude,
    })

    await this.cache.deleteMatching('trainings:list:')
    return PrismaTrainingMapper.toDomain(training as unknown as PrismaTrainingRecord)
  }

  async enroll(trainingId: string, studentId: string) {
    const training = await this.prisma.training.findUnique({
      where: { id: trainingId },
      include: {
        ...trainingInclude,
        enrollments: {
          select: { studentId: true },
        },
      },
    })

    if (!training) {
      throw new AppError(404, 'Training not found')
    }

    if (training.enrollments.some((enrollment) => enrollment.studentId === studentId)) {
      throw new AppError(409, 'Student already enrolled in training')
    }

    if (training.enrollments.length >= training.maxParticipants) {
      throw new AppError(409, 'Training has reached max participants')
    }

    await this.prisma.trainingEnrollment.create({
      data: {
        trainingId,
        studentId,
      },
    })

    const updated = await this.prisma.training.findUniqueOrThrow({
      where: { id: trainingId },
      include: trainingInclude,
    })

    await this.cache.deleteMatching('trainings:list:')
    return PrismaTrainingMapper.toDomain(updated as unknown as PrismaTrainingRecord)
  }

  async unenroll(trainingId: string, studentId: string) {
    const enrollment = await this.prisma.trainingEnrollment.findFirst({
      where: { trainingId, studentId },
      select: { id: true },
    })

    if (!enrollment) {
      throw new AppError(404, 'Enrollment not found')
    }

    await this.prisma.trainingEnrollment.delete({
      where: { id: enrollment.id },
    })

    const updated = await this.prisma.training.findUniqueOrThrow({
      where: { id: trainingId },
      include: trainingInclude,
    })

    await this.cache.deleteMatching('trainings:list:')
    return PrismaTrainingMapper.toDomain(updated as unknown as PrismaTrainingRecord)
  }

  async remove(id: string) {
    const existing = await this.prisma.training.findUnique({
      where: { id },
      include: trainingInclude,
    })

    if (!existing) {
      throw new AppError(404, 'Training not found')
    }

    await this.prisma.training.delete({
      where: { id },
    })

    await this.cache.deleteMatching('trainings:list:')
    return PrismaTrainingMapper.toDomain(existing as unknown as PrismaTrainingRecord)
  }
}
