import { Injectable } from '@nestjs/common';
import { EntityStatus, Prisma, SwimmingCategory } from '@prisma/client';
import { CacheRepository } from '@/infra/cache/cache-repository';
import {
  buildPaginatedCacheKey,
  rememberPaginatedResult,
} from '@/infra/cache/cache.helpers';
import { EnvService } from '@/infra/env/env.service';
import {
  createPaginatedResult,
  normalizePaginationParams,
} from '@/domain/shared/pagination/pagination-utils';
import {
  StudentsRepository,
  type CreateStudentRepositoryInput,
  type ListStudentsRepositoryParams,
  type ListUpcomingBirthdaysParams,
  type UpcomingBirthday,
  type StudentReferenceData,
  type StudentSeasonCategoryHistoryItem,
  type UpdateStudentRepositoryInput,
} from '@/domain/students/application/repositories/students-repository';
import { StudentClassAssignmentPolicy } from '@/domain/students/application/services/student-class-assignment-policy';
import { AppError } from '@/shared/errors/app-error';
import {
  formatCategoryLabel,
  parseCategoryValue,
} from '@/shared/utils/domain-formatters';
import { PrismaService } from '../prisma.service';
import { assertLegacyPhotoWriteAllowed } from './legacy-photo-write-guard';
import {
  PrismaStudentMapper,
  type PrismaStudentRecord,
} from '../mappers/prisma-student-mapper';

// All Student-backed relations are checked before a hard delete. In particular,
// several assessment and guardian relations currently use ON DELETE CASCADE.
// This guard must stay exhaustive until a dedicated retention/purge policy exists.
const protectedStudentRelations = {
  guardians: true,
  exStudents: true,
  poolResults: true,
  openWaterResults: true,
  studentClasses: true,
  attendanceRecords: true,
  anthropometricAssessments: true,
  technicalAssessments: true,
  levelHistory: true,
  seasonCategories: true,
} as const;

const studentInclude = {
  category: { select: { name: true } },
  level: { select: { name: true } },
  guardians: {
    orderBy: [{ isPrimary: 'desc' as const }, { createdAt: 'asc' as const }],
    select: {
      parentId: true,
      isPrimary: true,
      parent: { select: { name: true, phone: true } },
    },
  },
  studentClasses: {
    where: { toDate: null },
    orderBy: { createdAt: 'asc' as const },
    select: { classId: true },
  },
};

@Injectable()
export class PrismaStudentsRepository implements StudentsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheRepository,
    private readonly env: EnvService,
  ) {}

  async findById(id: string, teacherProfileId?: string) {
    const student = await this.prisma.student.findFirst({
      where: {
        id,
        ...(teacherProfileId
          ? {
              studentClasses: {
                some: {
                  toDate: null,
                  swimmingClass: {
                    classTeachers: {
                      some: {
                        teacher: {
                          profileId: teacherProfileId,
                          status: 'Ativo',
                        },
                      },
                    },
                  },
                },
              },
            }
          : {}),
      },
      include: studentInclude,
    });
    return student
      ? PrismaStudentMapper.toDomain(student as PrismaStudentRecord)
      : null;
  }

  async list(params?: ListStudentsRepositoryParams) {
    const { page, perPage } = normalizePaginationParams(params);
    const normalizedSearch = params?.search?.trim().toLowerCase() || '';
    const normalizedCategory = params?.category?.trim() || '';
    const normalizedStatus = params?.status?.trim() || '';
    const categoryName = normalizedCategory
      ? Object.values(SwimmingCategory).find(
          (name) => name === parseCategoryValue(normalizedCategory),
        )
      : undefined;
    const statusName = normalizedStatus
      ? Object.values(EntityStatus).find(
          (name) =>
            name ===
            (normalizedStatus === 'Licença' ? 'Licenca' : normalizedStatus),
        )
      : undefined;
    if (
      (normalizedCategory && !categoryName) ||
      (normalizedStatus && !statusName)
    ) {
      return createPaginatedResult([], 0, { page, perPage });
    }
    const teacherProfileId = params?.teacherProfileId;
    const cacheKey = `${buildPaginatedCacheKey('students', page, perPage)}:${normalizedSearch}:${normalizedCategory}:${normalizedStatus}:teacher:${teacherProfileId ?? 'admin'}`;

    const readPage = async () => {
      const skip = (page - 1) * perPage;
      const where: Prisma.StudentWhereInput = {
        ...(teacherProfileId
          ? {
              studentClasses: {
                some: {
                  toDate: null,
                  swimmingClass: {
                    classTeachers: {
                      some: {
                        teacher: {
                          profileId: teacherProfileId,
                          status: 'Ativo',
                        },
                      },
                    },
                  },
                },
              },
            }
          : {}),
        ...(categoryName ? { category: { name: categoryName } } : {}),
        ...(statusName ? { status: statusName } : {}),
        ...(normalizedSearch
          ? {
              OR: [
                {
                  name: {
                    contains: normalizedSearch,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  guardians: {
                    some: {
                      parent: {
                        name: {
                          contains: normalizedSearch,
                          mode: 'insensitive' as const,
                        },
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      };
      const [students, total] = await this.prisma.$transaction([
        this.prisma.student.findMany({
          include: studentInclude,
          orderBy: { name: 'asc' },
          where,
          skip,
          take: perPage,
        }),
        this.prisma.student.count({ where }),
      ]);

      return createPaginatedResult(
        (students as PrismaStudentRecord[]).map(PrismaStudentMapper.toDomain),
        total,
        { page, perPage },
      );
    };

    // Do not cache records scoped to a teacher: revoking a class assignment
    // must take effect on the next request, not after cache TTL expiry.
    return teacherProfileId
      ? readPage()
      : rememberPaginatedResult(
          this.cache,
          cacheKey,
          this.env.cacheTtlSeconds,
          readPage,
        );
  }

  async listUpcomingBirthdays(
    params: ListUpcomingBirthdaysParams,
  ): Promise<UpcomingBirthday[]> {
    if (params.dayKeys.length === 0) return [];

    // Keep teacher scoping identical to list(): only currently enrolled
    // students in classes assigned to the active linked teacher profile.
    // Use bound parameters for the calendar keys and profile UUID.
    const teacherScope = params.teacherProfileId
      ? Prisma.sql`
          AND EXISTS (
            SELECT 1
            FROM student_classes sc
            JOIN classes c ON c.id = sc.class_id
            JOIN class_teachers ct ON ct.class_id = c.id
            JOIN teachers t ON t.id = ct.teacher_id
            WHERE sc.student_id = s.id
              AND sc.to_date IS NULL
              AND t.profile_id = ${params.teacherProfileId}::uuid
              AND t.status = 'Ativo'
          )
        `
      : Prisma.empty;

    const birthdays = await this.prisma.$queryRaw<
      Array<{ id: string; name: string; birthDate: Date }>
    >(Prisma.sql`
      SELECT s.id, s.name, s.birth_date AS "birthDate"
      FROM students s
      WHERE s.status = 'Ativo'
        AND s.birth_date IS NOT NULL
        AND to_char(s.birth_date, 'MM-DD') IN (${Prisma.join(params.dayKeys)})
        ${teacherScope}
      ORDER BY s.name ASC, s.id ASC
    `);

    return birthdays.map((student) => ({
      id: student.id,
      name: student.name,
      birthDate: student.birthDate.toISOString().slice(0, 10),
    }));
  }

  async listReferenceData(): Promise<StudentReferenceData> {
    const [categories, levels, activeSeason] = await Promise.all([
      this.prisma.category.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.level.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.season.findFirst({
        where: { status: 'ACTIVE' },
        select: { id: true, year: true },
        orderBy: { year: 'desc' },
      }),
    ]);

    return {
      categories,
      levels,
      activeSeasonId: activeSeason?.id,
      activeSeasonYear: activeSeason?.year,
    };
  }

  async listSeasonCategories(
    studentId: string,
  ): Promise<StudentSeasonCategoryHistoryItem[]> {
    const rows = await this.prisma.studentSeasonCategory.findMany({
      where: { studentId },
      select: {
        assignedAt: true,
        season: {
          select: {
            id: true,
            year: true,
            label: true,
            status: true,
            startsOn: true,
            endsOn: true,
          },
        },
        category: { select: { id: true, name: true } },
      },
      orderBy: [{ season: { year: 'desc' } }, { assignedAt: 'desc' }],
    });

    return rows.map((row) => ({
      seasonId: row.season.id,
      year: row.season.year,
      seasonLabel: row.season.label,
      seasonStatus: row.season.status,
      startsOn: row.season.startsOn.toISOString().slice(0, 10),
      endsOn: row.season.endsOn.toISOString().slice(0, 10),
      categoryId: row.category.id,
      category: formatCategoryLabel(row.category.name),
      assignedAt: row.assignedAt.toISOString(),
    }));
  }

  async create(input: CreateStudentRepositoryInput) {
    const student = await this.prisma.$transaction(async (tx) => {
      const created = await tx.student.create({
        data: {
          name: input.name,
          gender: input.gender,
          birthDate: new Date(input.birthDate),
          categoryId: input.categoryId,
          levelId: input.levelId,
          phone: input.phone,
          photo: input.photo || null,
          status: input.status as never,
          achievements: 0,
        },
      });

      if (input.parentId) {
        await tx.studentGuardian.create({
          data: {
            studentId: created.id,
            parentId: input.parentId,
            isPrimary: true,
          },
        });
      }

      if (input.seasonId) {
        await tx.studentSeasonCategory.create({
          data: {
            studentId: created.id,
            seasonId: input.seasonId,
            categoryId: input.categoryId,
          },
        });
      }

      if (input.classId) {
        await tx.studentClass.create({
          data: {
            studentId: created.id,
            classId: input.classId,
            isPrimary: true,
          },
        });
      }

      return tx.student.findUniqueOrThrow({
        where: { id: created.id },
        include: studentInclude,
      });
    });

    await this.cache.deleteMatching('students:list:');
    await this.cache.deleteMatching('parents:list:');
    return PrismaStudentMapper.toDomain(student as PrismaStudentRecord);
  }

  async update(id: string, input: UpdateStudentRepositoryInput) {
    const existing = await this.prisma.student.findUnique({
      where: { id },
      select: {
        id: true,
        studentClasses: {
          where: { toDate: null },
          select: { classId: true },
        },
      },
    });

    if (!existing) throw new AppError(404, 'Student not found');

    const classAssignmentPlan = StudentClassAssignmentPolicy.plan(
      existing.studentClasses.map((link) => link.classId),
      input.classId,
    );

    const student = await this.prisma.$transaction(async (tx) => {
      if (input.seasonId) {
        const recorded = await tx.studentSeasonCategory.findUnique({
          where: {
            studentId_seasonId: { studentId: id, seasonId: input.seasonId },
          },
          select: { categoryId: true },
        });
        if (recorded && recorded.categoryId !== input.categoryId) {
          // Results can link to the season directly or through their event.
          // Guard before any student/guardian/class write takes place.
          const resultScope = {
            studentId: id,
            OR: [
              { seasonId: input.seasonId },
              { event: { is: { seasonId: input.seasonId } } },
            ],
          };
          const [poolCount, openWaterCount] = await Promise.all([
            tx.poolResult.count({ where: resultScope }),
            tx.openWaterResult.count({ where: resultScope }),
          ]);
          if (poolCount > 0 || openWaterCount > 0) {
            throw new AppError(
              409,
              'Season category cannot change while linked competition results exist',
            );
          }
        }
      }

      await assertLegacyPhotoWriteAllowed(tx, 'student-photo', id, input.photo);
      await tx.student.update({
        where: { id },
        data: {
          name: input.name,
          gender: input.gender,
          birthDate: new Date(input.birthDate),
          categoryId: input.categoryId,
          levelId: input.levelId,
          phone: input.phone,
          photo: input.photo || null,
          status: input.status as never,
        },
      });

      // Preserve secondary guardians when the principal changes. An explicit
      // null removes the principal designation, not the other relationships.
      await tx.studentGuardian.updateMany({
        where: { studentId: id, isPrimary: true },
        data: { isPrimary: false },
      });
      if (input.parentId) {
        await tx.studentGuardian.upsert({
          where: {
            studentId_parentId: { studentId: id, parentId: input.parentId },
          },
          create: { studentId: id, parentId: input.parentId, isPrimary: true },
          update: { isPrimary: true },
        });
      }

      if (input.seasonId) {
        await tx.studentSeasonCategory.upsert({
          where: {
            studentId_seasonId: { studentId: id, seasonId: input.seasonId },
          },
          create: {
            studentId: id,
            seasonId: input.seasonId,
            categoryId: input.categoryId,
          },
          update: { categoryId: input.categoryId },
        });
      }

      if (classAssignmentPlan.classIdsToClose.length > 0) {
        await tx.studentClass.updateMany({
          where: {
            studentId: id,
            toDate: null,
            classId: {
              in: classAssignmentPlan.classIdsToClose,
            },
          },
          data: {
            toDate: new Date(),
            isPrimary: false,
          },
        });
      }

      if (
        classAssignmentPlan.shouldPromoteExistingLink &&
        classAssignmentPlan.nextClassId
      ) {
        await tx.studentClass.updateMany({
          where: {
            studentId: id,
            classId: classAssignmentPlan.nextClassId,
            toDate: null,
          },
          data: { isPrimary: true },
        });
      }

      if (
        classAssignmentPlan.shouldCreateNextClassLink &&
        classAssignmentPlan.nextClassId
      ) {
        await tx.studentClass.create({
          data: {
            studentId: id,
            classId: classAssignmentPlan.nextClassId,
            isPrimary: true,
          },
        });
      }

      return tx.student.findUniqueOrThrow({
        where: { id },
        include: studentInclude,
      });
    });

    await this.cache.deleteMatching('students:list:');
    await this.cache.deleteMatching('parents:list:');
    return PrismaStudentMapper.toDomain(student as PrismaStudentRecord);
  }

  async remove(id: string) {
    // Lock the parent before checking for children: foreign-key inserts need
    // KEY SHARE and cannot race a deletion across this FOR UPDATE lock.
    // Only truly unused students may be permanently removed.
    const existing = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT id FROM students WHERE id = ${id}::uuid FOR UPDATE`,
      );
      if (locked.length === 0) {
        throw new AppError(404, 'Student not found');
      }

      const student = await tx.student.findUniqueOrThrow({
        where: { id },
        include: {
          ...studentInclude,
          _count: { select: protectedStudentRelations },
        },
      });

      if (
        student.photo ||
        student.achievements > 0 ||
        Object.values(student._count).some((count) => count > 0)
      ) {
        throw new AppError(
          409,
          'Student has linked records or history. Archive instead of deleting.',
        );
      }

      try {
        await tx.student.delete({ where: { id } });
      } catch (error) {
        // A new foreign-key relationship must fail closed, not become a 500
        // or be silently removed.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2003' || error.code === 'P2014')
        ) {
          throw new AppError(
            409,
            'Student has linked records. Archive instead of deleting.',
          );
        }
        throw error;
      }
      return student;
    });

    await this.cache.deleteMatching('students:list:');
    await this.cache.deleteMatching('parents:list:');
    return PrismaStudentMapper.toDomain(existing as PrismaStudentRecord);
  }
}
