import { Injectable } from '@nestjs/common'
import type { SaveAttendanceBatchRequest } from '@/domain/attendance/application/dtos/attendance-requests'
import { AttendanceRepository } from '@/domain/attendance/application/repositories/attendance-repository'
import type { ListAttendanceRepositoryParams } from '@/domain/attendance/application/repositories/attendance-repository'
import { AppError } from '@/shared/errors/app-error'
import { CacheRepository } from '@/infra/cache/cache-repository'
import { EnvService } from '@/infra/env/env.service'
import { PrismaAttendanceRecordMapper, type PrismaAttendanceRecord } from '../mappers/prisma-attendance-record-mapper'
import { PrismaService } from '../prisma.service'

@Injectable()
export class PrismaAttendanceRepository implements AttendanceRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheRepository: CacheRepository,
    private readonly envService: EnvService,
  ) {}

  async list(params?: ListAttendanceRepositoryParams) {
    const page = Math.max(1, params?.page ?? 1)
    const perPage = Math.min(100, Math.max(1, params?.perPage ?? 20))
    const search = params?.search?.trim()
    const startDate = params?.startDate?.trim()
    const endDate = params?.endDate?.trim()
    const classId = params?.classId?.trim()
    const studentId = params?.studentId?.trim()
    const status = params?.status?.trim()
    const cacheKey = `attendance:list:${page}:${perPage}:${search ?? ''}:${startDate ?? ''}:${endDate ?? ''}:${classId ?? ''}:${studentId ?? ''}:${status ?? ''}`

    const where = {
      ...(search
        ? {
            student: {
              name: {
                contains: search,
                mode: 'insensitive' as const,
              },
            },
          }
        : {}),
      ...(startDate || endDate
        ? {
            date: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
      ...(classId ? { classId } : {}),
      ...(studentId ? { studentId } : {}),
      ...(status ? { status: status as never } : {}),
    }

    const cached = await this.cacheRepository.get(cacheKey)
    if (cached) {
      return JSON.parse(cached) as {
        items: ReturnType<typeof PrismaAttendanceRecordMapper.toDomain>[]
        total: number
        page: number
        perPage: number
      }
    }

    const [records, total] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          studentId: true,
          classId: true,
          date: true,
          status: true,
          observations: true,
          savedAt: true,
        },
      }),
      this.prisma.attendanceRecord.count({ where }),
    ])

    const result = {
      items: (records as PrismaAttendanceRecord[]).map(PrismaAttendanceRecordMapper.toDomain),
      total,
      page,
      perPage,
    }

    await this.cacheRepository.set(cacheKey, JSON.stringify(result), this.envService.cacheTtlSeconds)

    return result
  }

  async saveBatch(input: SaveAttendanceBatchRequest) {
    if (input.records.length === 0) {
      return []
    }

    const duplicatedKeys = new Set<string>()
    const seenKeys = new Set<string>()
    for (const record of input.records) {
      const key = `${record.studentId}:${record.classId}:${record.date}`
      if (seenKeys.has(key)) {
        duplicatedKeys.add(key)
      }
      seenKeys.add(key)
    }

    if (duplicatedKeys.size > 0) {
      throw new AppError(422, 'Duplicate attendance records found in request batch')
    }

    const studentIds = [...new Set(input.records.map((record) => record.studentId))]
    const classIds = [...new Set(input.records.map((record) => record.classId))]

    const [students, classes] = await Promise.all([
      this.prisma.student.findMany({ where: { id: { in: studentIds } }, select: { id: true } }),
      this.prisma.swimmingClass.findMany({ where: { id: { in: classIds } }, select: { id: true } }),
    ])

    const foundStudentIds = new Set(students.map((student) => student.id))
    const foundClassIds = new Set(classes.map((classItem) => classItem.id))

    const missingStudentIds = studentIds.filter((studentId) => !foundStudentIds.has(studentId))
    const missingClassIds = classIds.filter((classId) => !foundClassIds.has(classId))

    if (missingStudentIds.length > 0) {
      throw new AppError(422, `Students not found: ${missingStudentIds.join(', ')}`)
    }

    if (missingClassIds.length > 0) {
      throw new AppError(422, `Classes not found: ${missingClassIds.join(', ')}`)
    }

    const activeStudentClassLinks = await this.prisma.studentClass.findMany({
      where: {
        toDate: null,
        OR: input.records.map((record) => ({
          studentId: record.studentId,
          classId: record.classId,
        })),
      },
      select: {
        studentId: true,
        classId: true,
      },
    })

    const validLinks = new Set(activeStudentClassLinks.map((link) => `${link.studentId}:${link.classId}`))
    const invalidLinks = input.records.filter(
      (record) => !validLinks.has(`${record.studentId}:${record.classId}`),
    )

    if (invalidLinks.length > 0) {
      throw new AppError(
        422,
        `Students without active class link: ${invalidLinks
          .map((record) => `${record.studentId}:${record.classId}`)
          .join(', ')}`,
      )
    }

    const savedRecords = await this.prisma.$transaction(async (tx) => {
      const persisted = await Promise.all(
        input.records.map((record) =>
          tx.attendanceRecord.upsert({
            where: {
              studentId_classId_date: {
                studentId: record.studentId,
                classId: record.classId,
                date: new Date(record.date),
              },
            },
            update: {
              status: record.status,
              observations: record.observations ?? '',
              savedAt: record.savedAt ? new Date(record.savedAt) : new Date(),
            },
            create: {
              studentId: record.studentId,
              classId: record.classId,
              date: new Date(record.date),
              status: record.status,
              observations: record.observations ?? '',
              savedAt: record.savedAt ? new Date(record.savedAt) : new Date(),
            },
            select: {
              id: true,
              studentId: true,
              classId: true,
              date: true,
              status: true,
              observations: true,
              savedAt: true,
            },
          }),
        ),
      )

      return persisted as PrismaAttendanceRecord[]
    })

    await this.cacheRepository.deleteMatching('attendance:list:')

    return savedRecords.map(PrismaAttendanceRecordMapper.toDomain)
  }
}
