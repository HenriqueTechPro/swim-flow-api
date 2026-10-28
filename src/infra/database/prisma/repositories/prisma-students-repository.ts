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
  type UpdateStudentRepositoryInput,
} from '@/domain/students/application/repositories/students-repository';
import { StudentClassAssignmentPolicy } from '@/domain/students/application/services/student-class-assignment-policy';
import { AppError } from '@/shared/errors/app-error';
import { parseCategoryValue } from '@/shared/utils/domain-formatters';
import { PrismaService } from '../prisma.service';
import { assertLegacyPhotoWriteAllowed } from './legacy-photo-write-guard';
import {
  PrismaStudentMapper,
  type PrismaStudentRecord,
} from '../mappers/prisma-student-mapper';

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
    const existing = await this.prisma.student.findUnique({
      where: { id },
      include: studentInclude,
    });

    if (!existing) throw new AppError(404, 'Student not found');

    await this.prisma.student.delete({
      where: { id },
    });

    await this.cache.deleteMatching('students:list:');
    await this.cache.deleteMatching('parents:list:');
    return PrismaStudentMapper.toDomain(existing as PrismaStudentRecord);
  }
}
