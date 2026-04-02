import { Injectable } from '@nestjs/common'
import { CacheRepository } from '@/infra/cache/cache-repository'
import { buildPaginatedCacheKey, rememberPaginatedResult } from '@/infra/cache/cache.helpers'
import { EnvService } from '@/infra/env/env.service'
import { expandTeacherCategorySelection } from '@/shared/lib/teacher-categories'
import { createPaginatedResult, normalizePaginationParams } from '@/domain/shared/pagination/pagination-utils'
import { TeachersRepository, type CreateTeacherRepositoryInput, type ListTeachersRepositoryParams, type UpdateTeacherRepositoryInput } from '@/domain/teachers/application/repositories/teachers-repository'
import { AppError } from '@/shared/errors/app-error'
import { parseCategoryValue } from '@/shared/utils/domain-formatters'
import { PrismaService } from '../prisma.service'
import { PrismaTeacherMapper, type PrismaTeacherRecord } from '../mappers/prisma-teacher-mapper'

type TeacherSyncTx = {
  teacherCategory: {
    deleteMany(args: { where: { teacherId: string } }): Promise<unknown>
    createMany(args: { data: Array<{ teacherId: string; categoryId: string }> }): Promise<unknown>
  }
  category: {
    findMany(args: {
      where: { name: { in: never[] } }
      select: { id: true; name: true }
    }): Promise<Array<{ id: string; name: string }>>
  }
  teacherCertification: {
    deleteMany(args: { where: { teacherId: string } }): Promise<unknown>
    createMany(args: { data: Array<{ teacherId: string; name: string }> }): Promise<unknown>
  }
}

const teacherInclude = {
  teacherCategories: {
    include: {
      category: {
        select: { name: true },
      },
    },
  },
  teacherCertifications: {
    orderBy: { createdAt: 'asc' as const },
    select: { name: true },
  },
  classTeachers: {
    select: { classId: true },
  },
}

const parseCertifications = (input?: string | null) =>
  (input ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

@Injectable()
export class PrismaTeachersRepository implements TeachersRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheRepository,
    private readonly env: EnvService,
  ) {}

  async list(params?: ListTeachersRepositoryParams) {
    const { page, perPage } = normalizePaginationParams(params)
    const normalizedSearch = params?.search?.trim().toLowerCase() || ''
    const normalizedStatus = params?.status?.trim() || ''
    const cacheKey = `${buildPaginatedCacheKey('teachers', page, perPage)}:${normalizedSearch}:${normalizedStatus}`

    return rememberPaginatedResult(this.cache, cacheKey, this.env.cacheTtlSeconds, async () => {
      const skip = (page - 1) * perPage
      const where = {
        ...(normalizedStatus ? { status: normalizedStatus as never } : {}),
        ...(normalizedSearch
          ? {
              OR: [
                { name: { contains: normalizedSearch, mode: 'insensitive' as const } },
                { speciality: { contains: normalizedSearch, mode: 'insensitive' as const } },
                { email: { contains: normalizedSearch, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      }
      const [teachers, total] = await this.prisma.$transaction([
        this.prisma.teacher.findMany({
          include: teacherInclude,
          orderBy: { name: 'asc' },
          where,
          skip,
          take: perPage,
        }),
        this.prisma.teacher.count({ where }),
      ])

      const typedTeachers = teachers as PrismaTeacherRecord[]
      const classStudentCountMap = await this.loadStudentCountsForClassIds(
        typedTeachers.flatMap((teacher) => teacher.classTeachers.map((item) => item.classId)),
      )

      return createPaginatedResult(
        typedTeachers.map((teacher) => PrismaTeacherMapper.toDomain(teacher, classStudentCountMap)),
        total,
        { page, perPage },
      )
    })
  }

  async create(input: CreateTeacherRepositoryInput) {
    const teacher = await this.prisma.$transaction(async (tx) => {
      const created = await tx.teacher.create({
        data: {
          name: input.name,
          cpf: input.cpf || null,
          birthDate: input.birthDate ? new Date(input.birthDate) : null,
          email: input.email,
          phone: input.phone,
          photo: input.photo || null,
          speciality: input.specialities.join(', '),
          experience: parseInt(input.experience, 10) || 0,
          status: input.status as never,
          bio: input.bio?.trim() || null,
        },
      })

      await this.syncCategories(tx, created.id, input.categories)
      await this.syncCertifications(tx, created.id, input.certifications)

      return tx.teacher.findUniqueOrThrow({
        where: { id: created.id },
        include: teacherInclude,
      })
    })

    await this.cache.deleteMatching('teachers:list:')
    return PrismaTeacherMapper.toDomain(teacher as PrismaTeacherRecord, new Map())
  }

  async update(id: string, input: UpdateTeacherRepositoryInput) {
    const existing = await this.prisma.teacher.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!existing) throw new AppError(404, 'Teacher not found')

    const teacher = await this.prisma.$transaction(async (tx) => {
      await tx.teacher.update({
        where: { id },
        data: {
          name: input.name,
          cpf: input.cpf || null,
          birthDate: input.birthDate ? new Date(input.birthDate) : null,
          email: input.email,
          phone: input.phone,
          photo: input.photo || null,
          speciality: input.specialities.join(', '),
          experience: parseInt(input.experience, 10) || 0,
          status: input.status as never,
          bio: input.bio?.trim() || null,
        },
      })

      await this.syncCategories(tx, id, input.categories)
      await this.syncCertifications(tx, id, input.certifications)

      return tx.teacher.findUniqueOrThrow({
        where: { id },
        include: teacherInclude,
      })
    })

    const classStudentCountMap = await this.loadStudentCountsForClassIds(
      (teacher as PrismaTeacherRecord).classTeachers.map((item) => item.classId),
    )

    await this.cache.deleteMatching('teachers:list:')
    return PrismaTeacherMapper.toDomain(teacher as PrismaTeacherRecord, classStudentCountMap)
  }

  async remove(id: string) {
    const existing = await this.prisma.teacher.findUnique({
      where: { id },
      include: teacherInclude,
    })

    if (!existing) throw new AppError(404, 'Teacher not found')

    await this.prisma.teacher.delete({
      where: { id },
    })

    const classStudentCountMap = await this.loadStudentCountsForClassIds(
      (existing as PrismaTeacherRecord).classTeachers.map((item) => item.classId),
    )

    await this.cache.deleteMatching('teachers:list:')
    return PrismaTeacherMapper.toDomain(existing as PrismaTeacherRecord, classStudentCountMap)
  }

  private async loadStudentCountsForClassIds(classIds: string[]) {
    const uniqueClassIds = [...new Set(classIds)]
    if (uniqueClassIds.length === 0) return new Map<string, number>()

    const studentCounts = await this.prisma.studentClass.groupBy({
      by: ['classId'],
      where: { classId: { in: uniqueClassIds }, toDate: null },
      _count: { studentId: true },
    })

    return new Map<string, number>(studentCounts.map((item) => [item.classId, item._count.studentId]))
  }

  private async syncCategories(
    tx: TeacherSyncTx,
    teacherId: string,
    selectedCategories: string[],
  ) {
    await tx.teacherCategory.deleteMany({
      where: { teacherId },
    })

    const expandedCategories = expandTeacherCategorySelection(selectedCategories).map(parseCategoryValue)
    if (expandedCategories.length === 0) return

    const categories = await tx.category.findMany({
      where: { name: { in: expandedCategories as never[] } },
      select: { id: true, name: true },
    })

    const byName = new Map(categories.map((row) => [row.name, row.id]))
    const missing = expandedCategories.filter((category) => !byName.has(category as never))
    if (missing.length > 0) {
      throw new AppError(422, `Categories not found: ${missing.join(', ')}`)
    }

    await tx.teacherCategory.createMany({
      data: expandedCategories.map((category) => ({
        teacherId,
        categoryId: byName.get(category as never) as string,
      })),
    })
  }

  private async syncCertifications(
    tx: TeacherSyncTx,
    teacherId: string,
    certifications?: string | null,
  ) {
    await tx.teacherCertification.deleteMany({
      where: { teacherId },
    })

    const names = parseCertifications(certifications)
    if (names.length === 0) return

    await tx.teacherCertification.createMany({
      data: names.map((name) => ({
        teacherId,
        name,
      })),
    })
  }
}
