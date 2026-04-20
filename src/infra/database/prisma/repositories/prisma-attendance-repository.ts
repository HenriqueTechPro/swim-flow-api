import { Injectable } from '@nestjs/common';
import type { SaveAttendanceBatchRequest } from '@/domain/attendance/application/dtos/attendance-requests';
import {
  AttendanceRepository,
  type AttendanceBatchContext,
  type ListAttendanceRepositoryParams,
  type AttendanceSummary,
  type AttendanceSummaryParams,
} from '@/domain/attendance/application/repositories/attendance-repository';
import { CacheRepository } from '@/infra/cache/cache-repository';
import { EnvService } from '@/infra/env/env.service';
import {
  PrismaAttendanceRecordMapper,
  type PrismaAttendanceRecord,
} from '../mappers/prisma-attendance-record-mapper';

const buildAttendanceWhere = (
  params?: Pick<
    ListAttendanceRepositoryParams,
    'search' | 'startDate' | 'endDate' | 'classId' | 'studentId' | 'status'
  >,
) => {
  const search = params?.search?.trim();
  const startDate = params?.startDate?.trim();
  const endDate = params?.endDate?.trim();
  const classId = params?.classId?.trim();
  const studentId = params?.studentId?.trim();
  const status = params?.status?.trim();

  return {
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
  };
};
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaAttendanceRepository implements AttendanceRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheRepository: CacheRepository,
    private readonly envService: EnvService,
  ) {}

  async list(params?: ListAttendanceRepositoryParams) {
    const page = Math.max(1, params?.page ?? 1);
    const perPage = Math.min(100, Math.max(1, params?.perPage ?? 20));
    const search = params?.search?.trim();
    const startDate = params?.startDate?.trim();
    const endDate = params?.endDate?.trim();
    const classId = params?.classId?.trim();
    const studentId = params?.studentId?.trim();
    const status = params?.status?.trim();
    const cacheKey = `attendance:list:${page}:${perPage}:${search ?? ''}:${startDate ?? ''}:${endDate ?? ''}:${classId ?? ''}:${studentId ?? ''}:${status ?? ''}`;
    const where = buildAttendanceWhere(params);

    const cached = await this.cacheRepository.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as {
        items: ReturnType<typeof PrismaAttendanceRecordMapper.toDomain>[];
        total: number;
        page: number;
        perPage: number;
      };
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
    ]);

    const result = {
      items: (records as PrismaAttendanceRecord[]).map(
        PrismaAttendanceRecordMapper.toDomain,
      ),
      total,
      page,
      perPage,
    };

    await this.cacheRepository.set(
      cacheKey,
      JSON.stringify(result),
      this.envService.cacheTtlSeconds,
    );

    return result;
  }

  async summary(params?: AttendanceSummaryParams): Promise<AttendanceSummary> {
    const date = params?.date?.trim();
    const startDate = (params?.startDate?.trim() || date) ?? undefined;
    const endDate = (params?.endDate?.trim() || date) ?? undefined;
    const classId = params?.classId?.trim();
    const studentId = params?.studentId?.trim();

    const where = buildAttendanceWhere({
      startDate,
      endDate,
      classId,
      studentId,
    });

    const [records, classes] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where,
        orderBy: [{ date: 'desc' }, { savedAt: 'desc' }],
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
      this.prisma.swimmingClass.findMany({
        where: {
          status: 'Ativa',
          ...(classId ? { id: classId } : {}),
          ...(studentId
            ? {
                studentClasses: {
                  some: {
                    studentId,
                    toDate: null,
                    student: { is: { status: 'Ativo' } },
                  },
                },
              }
            : {}),
        },
        select: {
          id: true,
          studentClasses: {
            where: {
              toDate: null,
              ...(studentId ? { studentId } : {}),
              student: { is: { status: 'Ativo' } },
            },
            select: {
              studentId: true,
            },
          },
        },
      }),
    ]);

    const domainRecords = (records as PrismaAttendanceRecord[]).map(
      PrismaAttendanceRecordMapper.toDomain,
    );

    const classSummaries = classes
      .map((classItem) => {
        const classRecords = domainRecords.filter(
          (record) => record.classId === classItem.id,
        );
        const totalStudents = classItem.studentClasses.length;
        const recordedStudents = new Set(
          classRecords.map((record) => record.studentId),
        ).size;
        const savedAt = classRecords
          .map((record) => record.savedAt)
          .filter((value): value is string => Boolean(value))
          .sort()
          .at(-1);

        return {
          classId: classItem.id,
          totalStudents,
          recordedStudents,
          presentCount: classRecords.filter((record) => record.status === 'present')
            .length,
          absentCount: classRecords.filter((record) => record.status === 'absent')
            .length,
          lateCount: classRecords.filter((record) => record.status === 'late').length,
          justifiedCount: classRecords.filter(
            (record) => record.status === 'justified',
          ).length,
          isCompleted: totalStudents > 0 && recordedStudents >= totalStudents,
          savedAt,
        };
      })
      .sort((left, right) => left.classId.localeCompare(right.classId));

    const studentSummaries = Array.from(
      domainRecords.reduce(
        (map, record) => {
          const current = map.get(record.studentId) ?? {
            studentId: record.studentId,
            totalClasses: 0,
            presentCount: 0,
            absentCount: 0,
            lateCount: 0,
            justifiedCount: 0,
          };

          current.totalClasses += 1;
          if (record.status === 'present') current.presentCount += 1;
          if (record.status === 'absent') current.absentCount += 1;
          if (record.status === 'late') current.lateCount += 1;
          if (record.status === 'justified') current.justifiedCount += 1;

          map.set(record.studentId, current);
          return map;
        },
        new Map<
          string,
          {
            studentId: string;
            totalClasses: number;
            presentCount: number;
            absentCount: number;
            lateCount: number;
            justifiedCount: number;
          }
        >(),
      ).values(),
    )
      .map((item) => ({
        ...item,
        attendancePercentage:
          item.totalClasses > 0
            ? Math.round(
                ((item.presentCount + item.lateCount + item.justifiedCount) /
                  item.totalClasses) *
                  100,
              )
            : 0,
      }))
      .sort((left, right) => left.studentId.localeCompare(right.studentId));

    const studentsWithAttendance = new Set(
      domainRecords.map((record) => record.studentId),
    ).size;
    const presentCount = domainRecords.filter(
      (record) => record.status === 'present',
    ).length;
    const absentCount = domainRecords.filter(
      (record) => record.status === 'absent',
    ).length;
    const lateCount = domainRecords.filter(
      (record) => record.status === 'late',
    ).length;
    const justifiedCount = domainRecords.filter(
      (record) => record.status === 'justified',
    ).length;
    const lastSavedAt = domainRecords
      .map((record) => record.savedAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1);

    return {
      date,
      startDate,
      endDate,
      totalClasses: classSummaries.length,
      completedClasses: classSummaries.filter((item) => item.isCompleted).length,
      pendingClasses: classSummaries.filter(
        (item) => item.totalStudents > 0 && !item.isCompleted,
      ).length,
      totalStudents: classSummaries.reduce(
        (sum, item) => sum + item.totalStudents,
        0,
      ),
      studentsWithAttendance,
      presentCount,
      absentCount,
      lateCount,
      justifiedCount,
      attendanceRate:
        studentsWithAttendance > 0
          ? Math.round(
              ((presentCount + lateCount + justifiedCount) /
                studentsWithAttendance) *
                100,
            )
          : 0,
      classes: classSummaries,
      students: studentSummaries,
      lastSavedAt,
    };
  }

  async getBatchContext(
    input: SaveAttendanceBatchRequest,
  ): Promise<AttendanceBatchContext> {
    if (input.records.length === 0) {
      return {
        existingStudentIds: [],
        existingClassIds: [],
        activeStudentClassLinks: [],
      };
    }

    const studentIds = [...new Set(input.records.map((record) => record.studentId))];
    const classIds = [...new Set(input.records.map((record) => record.classId))];

    const [students, classes, activeStudentClassLinks] = await Promise.all([
      this.prisma.student.findMany({
        where: { id: { in: studentIds } },
        select: { id: true },
      }),
      this.prisma.swimmingClass.findMany({
        where: { id: { in: classIds } },
        select: { id: true },
      }),
      this.prisma.studentClass.findMany({
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
      }),
    ]);

    return {
      existingStudentIds: students.map((student) => student.id),
      existingClassIds: classes.map((classItem) => classItem.id),
      activeStudentClassLinks,
    };
  }

  async saveBatch(input: SaveAttendanceBatchRequest) {
    if (input.records.length === 0) {
      return [];
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
      );

      return persisted as PrismaAttendanceRecord[];
    });

    await this.cacheRepository.deleteMatching('attendance:list:');

    return savedRecords.map(PrismaAttendanceRecordMapper.toDomain);
  }
}
