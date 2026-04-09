import { Injectable } from '@nestjs/common'
import { CacheRepository } from '@/infra/cache/cache-repository'
import { buildPaginatedCacheKey, rememberPaginatedResult } from '@/infra/cache/cache.helpers'
import { EnvService } from '@/infra/env/env.service'
import { createPaginatedResult, normalizePaginationParams } from '@/domain/shared/pagination/pagination-utils'
import {
  ExStudentsRepository,
  type CreateExStudentRepositoryInput,
  type ListExStudentsRepositoryParams,
  type UpdateExStudentRepositoryInput,
} from '@/domain/ex-students/application/repositories/ex-students-repository'
import { AppError } from '@/shared/errors/app-error'
import { formatCategoryLabel } from '@/shared/utils/domain-formatters'
import { PrismaService } from '../prisma.service'
import { PrismaExStudentMapper, type PrismaExStudentRecord } from '../mappers/prisma-ex-student-mapper'

const getBirthYearFromDate = (birthDate?: Date | null) => {
  if (!birthDate) return new Date().getFullYear()
  return Number(birthDate.toISOString().slice(0, 4))
}

@Injectable()
export class PrismaExStudentsRepository implements ExStudentsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheRepository,
    private readonly env: EnvService,
  ) {}

  async list(params?: ListExStudentsRepositoryParams) {
    const { page, perPage } = normalizePaginationParams(params)
    const search = params?.search?.trim()
    const category = params?.category?.trim()
    const cacheKey = `${buildPaginatedCacheKey('ex-students', page, perPage)}:${search ?? ''}:${category ?? ''}`

    return rememberPaginatedResult(this.cache, cacheKey, this.env.cacheTtlSeconds, async () => {
      const skip = (page - 1) * perPage
      const where = {
        ...(category ? { category: category } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { exitReason: { contains: search, mode: 'insensitive' as const } },
                { lastCompetition: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      }

      const [exStudents, total] = await this.prisma.$transaction([
        this.prisma.exStudent.findMany({
          where,
          orderBy: { name: 'asc' },
          skip,
          take: perPage,
        }),
        this.prisma.exStudent.count({ where }),
      ])

      return createPaginatedResult(
        (exStudents as unknown as PrismaExStudentRecord[]).map(PrismaExStudentMapper.toDomain),
        total,
        { page, perPage },
      )
    })
  }

  async create(input: CreateExStudentRepositoryInput) {
    const existingArchive = await this.prisma.exStudent.findFirst({
      where: { studentId: input.studentId },
      select: { id: true },
    })

    if (existingArchive) {
      throw new AppError(422, 'Este aluno já está com o plano desativado.')
    }

    const student = await this.prisma.student.findUnique({
      where: { id: input.studentId },
      include: {
        category: {
          select: { name: true },
        },
        level: {
          select: { name: true },
        },
        parent: {
          select: { name: true },
        },
      },
    })

    if (!student) {
      throw new AppError(404, 'Student not found')
    }

    const birthYear = getBirthYearFromDate(student.birthDate)
    const categorySnapshot = student.category ? formatCategoryLabel(student.category.name) : 'Nao Informada'
    const levelSnapshot = student.level?.name || 'Iniciante'
    const responsible = student.parent?.name || ''

    const exStudent = await this.prisma.$transaction(async (tx) => {
      const created = await tx.exStudent.create({
        data: {
          studentId: student.id,
          name: student.name,
          birthYear,
          birthDate: student.birthDate,
          category: categorySnapshot,
          categorySnapshot,
          level: levelSnapshot,
          levelSnapshot,
          responsible,
          responsibleSnapshot: responsible,
          parentId: student.parentId || null,
          phone: student.phone,
          exitDate: input.exitDate,
          exitDateAt: new Date(input.exitDate),
          exitReason: input.exitReason,
          exitReasonCode: input.exitReason,
          exitNotes: input.exitNotes || null,
          achievements: student.achievements || 0,
          lastCompetition: input.lastCompetition || '',
        },
      })

      await tx.student.update({
        where: { id: student.id },
        data: {
          status: 'Inativo',
        },
      })

      return tx.exStudent.findUniqueOrThrow({
        where: { id: created.id },
      })
    })

    await this.cache.deleteMatching('ex-students:list:')
    return PrismaExStudentMapper.toDomain(exStudent as unknown as PrismaExStudentRecord)
  }

  async update(id: string, input: UpdateExStudentRepositoryInput) {
    const existing = await this.prisma.exStudent.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!existing) {
      throw new AppError(404, 'Ex-student not found')
    }

    const exStudent = await this.prisma.exStudent.update({
      where: { id },
      data: {
        exitDate: input.exitDate,
        exitDateAt: new Date(input.exitDate),
        exitReason: input.exitReason,
        exitReasonCode: input.exitReason,
        exitNotes: input.exitNotes || null,
        achievements: input.achievements,
        lastCompetition: input.lastCompetition,
      },
    })

    await this.cache.deleteMatching('ex-students:list:')
    return PrismaExStudentMapper.toDomain(exStudent as unknown as PrismaExStudentRecord)
  }

  async remove(id: string) {
    const existing = await this.prisma.exStudent.findUnique({
      where: { id },
    })

    if (!existing) {
      throw new AppError(404, 'Ex-student not found')
    }

    await this.prisma.exStudent.delete({
      where: { id },
    })

    await this.cache.deleteMatching('ex-students:list:')
    return PrismaExStudentMapper.toDomain(existing as unknown as PrismaExStudentRecord)
  }

  async reactivate(id: string) {
    const existing = await this.prisma.exStudent.findUnique({
      where: { id },
    })

    if (!existing) {
      throw new AppError(404, 'Ex-student not found')
    }

    if (!existing.studentId) {
      throw new AppError(422, 'Nao e possivel reativar um ex-aluno sem vinculo com cadastro original.')
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id: existing.studentId as string },
        data: {
          status: 'Ativo',
        },
      })

      await tx.exStudent.delete({
        where: { id },
      })
    })

    await this.cache.deleteMatching('ex-students:list:')
    return PrismaExStudentMapper.toDomain(existing as unknown as PrismaExStudentRecord)
  }
}
