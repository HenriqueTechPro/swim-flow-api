import { Injectable } from '@nestjs/common'
import { CacheRepository } from '@/infra/cache/cache-repository'
import { buildPaginatedCacheKey, rememberPaginatedResult } from '@/infra/cache/cache.helpers'
import { EnvService } from '@/infra/env/env.service'
import { getCategoryByBirthYear } from '@/shared/lib/categories'
import { createPaginatedResult, normalizePaginationParams } from '@/domain/shared/pagination/pagination-utils'
import { StudentsRepository, type CreateStudentRepositoryInput, type ListStudentsRepositoryParams, type UpdateStudentRepositoryInput } from '@/domain/students/application/repositories/students-repository'
import { AppError } from '@/shared/errors/app-error'
import { normalizeHumanLabel, parseCategoryValue, parseEntityStatus } from '@/shared/utils/domain-formatters'
import { PrismaService } from '../prisma.service'
import { PrismaStudentMapper, type PrismaStudentRecord } from '../mappers/prisma-student-mapper'

const studentInclude = {
  category: { select: { name: true } },
  level: { select: { name: true } },
  parent: { select: { name: true } },
  studentClasses: {
    where: { toDate: null },
    orderBy: { createdAt: 'asc' as const },
    select: { classId: true },
  },
}

const resolveLevel = async (prisma: PrismaService, levelName: string) => {
  const directMatch = await prisma.level.findFirst({
    where: { name: levelName },
    select: { id: true, name: true },
  })

  if (directMatch) {
    return directMatch
  }

  const normalizedLevelName = normalizeHumanLabel(levelName)
  const levels = await prisma.level.findMany({
    select: { id: true, name: true },
  })

  return levels.find((level) => normalizeHumanLabel(level.name) === normalizedLevelName) ?? null
}

@Injectable()
export class PrismaStudentsRepository implements StudentsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheRepository,
    private readonly env: EnvService,
  ) {}

  async list(params?: ListStudentsRepositoryParams) {
    const { page, perPage } = normalizePaginationParams(params)
    const normalizedSearch = params?.search?.trim().toLowerCase() || ''
    const normalizedCategory = params?.category?.trim() || ''
    const normalizedStatus = params?.status?.trim() || ''
    const prismaStatus = normalizedStatus ? parseEntityStatus(normalizedStatus) : ''
    const cacheKey = `${buildPaginatedCacheKey('students', page, perPage)}:${normalizedSearch}:${normalizedCategory}:${prismaStatus}`

    return rememberPaginatedResult(this.cache, cacheKey, this.env.cacheTtlSeconds, async () => {
      const skip = (page - 1) * perPage
      const filters = [
        ...(normalizedCategory
          ? [
              {
                OR: [
                  { categoryLabel: normalizedCategory },
                  { category: { name: parseCategoryValue(normalizedCategory) as never } },
                ],
              },
            ]
          : []),
        ...(prismaStatus ? [{ status: prismaStatus as never }] : []),
        ...(normalizedSearch
          ? [
              {
                OR: [
                  { name: { contains: normalizedSearch, mode: 'insensitive' as const } },
                  { parent: { name: { contains: normalizedSearch, mode: 'insensitive' as const } } },
                ],
              },
            ]
          : []),
      ]
      const where = filters.length ? { AND: filters } : undefined
      const [students, total] = await this.prisma.$transaction([
        this.prisma.student.findMany({
          include: studentInclude,
          orderBy: { name: 'asc' },
          where,
          skip,
          take: perPage,
        }),
        this.prisma.student.count({ where }),
      ])

      return createPaginatedResult(
        (students as PrismaStudentRecord[]).map(PrismaStudentMapper.toDomain),
        total,
        { page, perPage },
      )
    })
  }

  async create(input: CreateStudentRepositoryInput) {
    const birthYear = Number(input.birthDate.slice(0, 4))
    const categoryName = parseCategoryValue(getCategoryByBirthYear(birthYear))

    const [category, level] = await Promise.all([
      this.prisma.category.findFirst({ where: { name: categoryName as never }, select: { id: true } }),
      resolveLevel(this.prisma, input.level),
    ])

    if (!category) throw new AppError(422, `Category "${categoryName}" not found`)
    if (!level) throw new AppError(422, `Level "${input.level}" not found`)

    const student = await this.prisma.$transaction(async (tx) => {
      const created = await tx.student.create({
        data: {
          name: input.name,
          gender: input.gender,
          birthDate: new Date(input.birthDate),
          categoryId: category.id,
          levelId: level.id,
          parentId: input.parentId || null,
          phone: input.phone,
          photo: input.photo || null,
          status: parseEntityStatus(input.status) as never,
          achievements: 0,
        },
      })

      if (input.classId) {
        await tx.studentClass.create({
          data: {
            studentId: created.id,
            classId: input.classId,
            isPrimary: true,
          },
        })
      }

      return tx.student.findUniqueOrThrow({
        where: { id: created.id },
        include: studentInclude,
      })
    })

    await this.cache.deleteMatching('students:list:')
    return PrismaStudentMapper.toDomain(student as PrismaStudentRecord)
  }

  async update(id: string, input: UpdateStudentRepositoryInput) {
    const birthYear = Number(input.birthDate.slice(0, 4))
    const categoryName = parseCategoryValue(getCategoryByBirthYear(birthYear))

    const [existing, category, level] = await Promise.all([
      this.prisma.student.findUnique({ where: { id }, select: { id: true } }),
      this.prisma.category.findFirst({ where: { name: categoryName as never }, select: { id: true } }),
      resolveLevel(this.prisma, input.level),
    ])

    if (!existing) throw new AppError(404, 'Student not found')
    if (!category) throw new AppError(422, `Category "${categoryName}" not found`)
    if (!level) throw new AppError(422, `Level "${input.level}" not found`)

    const student = await this.prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id },
        data: {
          name: input.name,
          gender: input.gender,
          birthDate: new Date(input.birthDate),
          categoryId: category.id,
          levelId: level.id,
          parentId: input.parentId || null,
          phone: input.phone,
          photo: input.photo || null,
          status: parseEntityStatus(input.status) as never,
        },
      })

      await tx.studentClass.deleteMany({ where: { studentId: id } })

      if (input.classId) {
        await tx.studentClass.create({
          data: {
            studentId: id,
            classId: input.classId,
            isPrimary: true,
          },
        })
      }

      return tx.student.findUniqueOrThrow({
        where: { id },
        include: studentInclude,
      })
    })

    await this.cache.deleteMatching('students:list:')
    return PrismaStudentMapper.toDomain(student as PrismaStudentRecord)
  }

  async remove(id: string) {
    const existing = await this.prisma.student.findUnique({
      where: { id },
      include: studentInclude,
    })

    if (!existing) throw new AppError(404, 'Student not found')

    await this.prisma.student.delete({
      where: { id },
    })

    await this.cache.deleteMatching('students:list:')
    return PrismaStudentMapper.toDomain(existing as PrismaStudentRecord)
}
}
