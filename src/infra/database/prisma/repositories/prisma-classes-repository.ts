import { Injectable } from '@nestjs/common';
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
import { sortGroupedCategories } from '@/shared/lib/categories';
import { expandTeacherCategorySelection } from '@/shared/lib/teacher-categories';
import {
  ClassesRepository,
  type AssignClassTeacherRepositoryInput,
  type CreateClassRepositoryInput,
  type ListClassesRepositoryParams,
  type TransferStudentRepositoryInput,
  type TransferTeacherRepositoryInput,
  type UpdateClassRepositoryInput,
  type UpdateClassTeacherRoleRepositoryInput,
} from '@/domain/classes/application/repositories/classes-repository';
import { AppError } from '@/shared/errors/app-error';
import { parseCategoryValue } from '@/shared/utils/domain-formatters';
import { ClassTeacherPolicy } from '@/domain/classes/application/services/class-teacher-policy';
import {
  getWeekdayLegacyVariants,
  normalizeWeekday,
} from '@/shared/contracts/weekdays';
import { PrismaService } from '../prisma.service';
import {
  PrismaClassMapper,
  type PrismaClassRecord,
} from '../mappers/prisma-class-mapper';

type ClassRelationsTx = {
  classCategory: {
    findMany(args: {
      where: { classId: string };
      select: { categoryId: true };
    }): Promise<Array<{ categoryId: string }>>;
    deleteMany(args: {
      where: { classId: string; categoryId: { notIn: string[] } };
    }): Promise<unknown>;
    createMany(args: {
      data: Array<{ classId: string; categoryId: string; isPrimary: boolean }>;
    }): Promise<unknown>;
    updateMany(args: {
      where: { classId: string; categoryId: string };
      data: { isPrimary: boolean };
    }): Promise<unknown>;
  };
  classTeacher: {
    deleteMany(args: {
      where: { classId: string } | { classId: string; teacherId: string };
    }): Promise<unknown>;
    createMany(args: {
      data: Array<{
        classId: string;
        teacherId: string;
        role: 'head_coach' | 'assistant_coach';
      }>;
    }): Promise<unknown>;
    create(args: {
      data: {
        classId: string;
        teacherId: string;
        role: 'head_coach' | 'assistant_coach';
      };
    }): Promise<unknown>;
    update(args: {
      where: { id: string };
      data: { role: 'head_coach' | 'assistant_coach' };
    }): Promise<unknown>;
  };
  classSchedule: {
    deleteMany(args: { where: { classId: string } }): Promise<unknown>;
    createMany(args: {
      data: Array<{
        classId: string;
        dayOfWeek: string;
        startTime: Date;
        endTime: Date;
      }>;
    }): Promise<unknown>;
  };
};

const classInclude = {
  pool: {
    select: { id: true, name: true, lengthMeters: true },
  },
  classTeachers: {
    include: {
      teacher: {
        select: { id: true, name: true, photo: true },
      },
    },
    orderBy: [{ role: 'asc' as const }, { createdAt: 'asc' as const }],
  },
  classSchedules: {
    orderBy: [{ dayOfWeek: 'asc' as const }, { startTime: 'asc' as const }],
  },
  studentClasses: {
    where: { toDate: null },
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
  classCategories: {
    include: {
      category: {
        select: { id: true, name: true },
      },
    },
    orderBy: [{ isPrimary: 'desc' as const }, { categoryId: 'asc' as const }],
  },
};

const toTimeDate = (value: string) => new Date(`1970-01-01T${value}:00.000Z`);

const toClassStatusInput = (status: CreateClassRepositoryInput['status']) =>
  status;

@Injectable()
export class PrismaClassesRepository implements ClassesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheRepository,
    private readonly env: EnvService,
  ) {}

  async list(params?: ListClassesRepositoryParams) {
    const { page, perPage } = normalizePaginationParams(params);
    const search = params?.search?.trim();
    const category = params?.category?.trim();
    const day = params?.day?.trim();
    const status = params?.status?.trim();
    const poolId = params?.poolId?.trim();
    const categoryNames = category
      ? expandTeacherCategorySelection([category]).map(parseCategoryValue)
      : [];
    const categoryIds =
      categoryNames.length > 0
        ? (
            await this.prisma.category.findMany({
              where: { name: { in: categoryNames as never[] } },
              select: { id: true },
            })
          ).map((item) => item.id)
        : [];

    if (categoryNames.length > 0 && categoryIds.length === 0) {
      return createPaginatedResult([], 0, { page, perPage });
    }
    const cacheKey = `${buildPaginatedCacheKey('classes', page, perPage)}:${search ?? ''}:${category ?? ''}:${day ?? ''}:${status ?? ''}:${poolId ?? ''}`;

    return rememberPaginatedResult(
      this.cache,
      cacheKey,
      this.env.cacheTtlSeconds,
      async () => {
        const skip = (page - 1) * perPage;
        const where = {
          ...(categoryIds.length > 0
            ? {
                classCategories: {
                  some: {
                    categoryId: {
                      in: categoryIds,
                    },
                  },
                },
              }
            : {}),
          ...(day
            ? {
                classSchedules: {
                  some: {
                    dayOfWeek: {
                      in: getWeekdayLegacyVariants(day),
                    },
                  },
                },
              }
            : {}),
          ...(status
            ? { status: status as 'Ativa' | 'Pausada' | 'Encerrada' }
            : {}),
          ...(poolId ? { poolId } : {}),
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: 'insensitive' as const } },
                  {
                    pool: {
                      name: { contains: search, mode: 'insensitive' as const },
                    },
                  },
                  {
                    classTeachers: {
                      some: {
                        teacher: {
                          name: {
                            contains: search,
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

        const [classes, total] = await this.prisma.$transaction([
          this.prisma.swimmingClass.findMany({
            where,
            include: classInclude,
            orderBy: { name: 'asc' },
            skip,
            take: perPage,
          }),
          this.prisma.swimmingClass.count({ where }),
        ]);

        return createPaginatedResult(
          (classes as unknown as PrismaClassRecord[]).map(
            PrismaClassMapper.toDomain,
          ),
          total,
          { page, perPage },
        );
      },
    );
  }

  async listCategoryReferenceData() {
    return this.prisma.category.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async create(input: CreateClassRepositoryInput) {
    const createdId = await this.prisma.$transaction(async (tx) => {
      const created = await tx.swimmingClass.create({
        data: {
          name: input.name,
          categoryId: input.categoryIds[0],
          maxStudents: input.maxStudents,
          poolId: input.poolId || null,
          status: toClassStatusInput(input.status),
        },
      });

      await this.replaceRelations(
        tx,
        created.id,
        input.categoryIds,
        input.classTeachers,
        input.schedules,
      );

      return created.id;
    });

    const classItem = (await this.prisma.swimmingClass.findUniqueOrThrow({
      where: { id: createdId },
      include: classInclude,
    })) as unknown as PrismaClassRecord;

    await this.cache.deleteMatching('classes:list:');
    return PrismaClassMapper.toDomain(classItem);
  }

  async update(id: string, input: UpdateClassRepositoryInput) {
    const existing = await this.prisma.swimmingClass.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) throw new AppError(404, 'Class not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.swimmingClass.update({
        where: { id },
        data: {
          name: input.name,
          categoryId: input.categoryIds[0],
          maxStudents: input.maxStudents,
          poolId: input.poolId || null,
          status: toClassStatusInput(input.status),
        },
      });

      await this.replaceRelations(
        tx,
        id,
        input.categoryIds,
        input.classTeachers,
        input.schedules,
      );
    });

    const classItem = (await this.prisma.swimmingClass.findUniqueOrThrow({
      where: { id },
      include: classInclude,
    })) as unknown as PrismaClassRecord;

    await this.cache.deleteMatching('classes:list:');
    return PrismaClassMapper.toDomain(classItem);
  }
  async addTeacher(classId: string, input: AssignClassTeacherRepositoryInput) {
    const classItem = (await this.prisma.swimmingClass.findUnique({
      where: { id: classId },
      include: classInclude,
    })) as unknown as PrismaClassRecord | null;

    if (!classItem) throw new AppError(404, 'Class not found');

    const teacher = await this.prisma.teacher.findUnique({
      where: { id: input.teacherId },
      select: { id: true },
    });

    if (!teacher) throw new AppError(404, 'Teacher not found');
    if (
      classItem.classTeachers.some((item) => item.teacherId === input.teacherId)
    ) {
      throw new AppError(409, 'Teacher already assigned to class');
    }

    await this.prisma.$transaction(async (tx) => {
      const requestedRole = ClassTeacherPolicy.resolveAddedRole(
        classItem.classTeachers,
        input.role,
      );

      await tx.classTeacher.create({
        data: {
          classId,
          teacherId: input.teacherId,
          role: requestedRole,
        },
      });
    });

    const updated = (await this.prisma.swimmingClass.findUniqueOrThrow({
      where: { id: classId },
      include: classInclude,
    })) as unknown as PrismaClassRecord;

    await this.cache.deleteMatching('classes:list:');
    return PrismaClassMapper.toDomain(updated);
  }

  async updateTeacherRole(
    classId: string,
    teacherId: string,
    input: UpdateClassTeacherRoleRepositoryInput,
  ) {
    const classItem = (await this.prisma.swimmingClass.findUnique({
      where: { id: classId },
      include: classInclude,
    })) as unknown as PrismaClassRecord | null;

    if (!classItem) throw new AppError(404, 'Class not found');

    const assignedTeacher = classItem.classTeachers.find(
      (item) => item.teacherId === teacherId,
    );
    if (!assignedTeacher) throw new AppError(404, 'Teacher not found in class');

    const roleUpdatePlan = ClassTeacherPolicy.planRoleUpdate(
      classItem.classTeachers,
      teacherId,
      input.role,
    );

    await this.prisma.$transaction(async (tx) => {
      if (roleUpdatePlan.demotedTeacherId) {
        await tx.classTeacher.update({
          where: { id: roleUpdatePlan.demotedTeacherId },
          data: { role: 'assistant_coach' },
        });
      }

      await tx.classTeacher.update({
        where: { id: assignedTeacher.id },
        data: { role: roleUpdatePlan.nextRole },
      });
    });

    const updated = (await this.prisma.swimmingClass.findUniqueOrThrow({
      where: { id: classId },
      include: classInclude,
    })) as unknown as PrismaClassRecord;

    await this.cache.deleteMatching('classes:list:');
    return PrismaClassMapper.toDomain(updated);
  }

  async removeTeacher(classId: string, teacherId: string) {
    const classItem = (await this.prisma.swimmingClass.findUnique({
      where: { id: classId },
      include: classInclude,
    })) as unknown as PrismaClassRecord | null;

    if (!classItem) throw new AppError(404, 'Class not found');

    const assignedTeacher = classItem.classTeachers.find(
      (item) => item.teacherId === teacherId,
    );
    if (!assignedTeacher) throw new AppError(404, 'Teacher not found in class');

    const removalPlan = ClassTeacherPolicy.planRemoval(
      classItem.classTeachers,
      teacherId,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.classTeacher.deleteMany({
        where: { classId, teacherId },
      });

      if (removalPlan.promotedTeacherId) {
        await tx.classTeacher.update({
          where: { id: removalPlan.promotedTeacherId },
          data: { role: 'head_coach' },
        });
      }
    });

    const updated = (await this.prisma.swimmingClass.findUniqueOrThrow({
      where: { id: classId },
      include: classInclude,
    })) as unknown as PrismaClassRecord;

    await this.cache.deleteMatching('classes:list:');
    return PrismaClassMapper.toDomain(updated);
  }

  async transferTeacher(input: TransferTeacherRepositoryInput) {
    const { teacherId, fromClassId, toClassId } = input;

    const [sourceClass, targetClass] = (await Promise.all([
      this.prisma.swimmingClass.findUnique({
        where: { id: fromClassId },
        include: classInclude,
      }),
      this.prisma.swimmingClass.findUnique({
        where: { id: toClassId },
        include: classInclude,
      }),
    ])) as [PrismaClassRecord | null, PrismaClassRecord | null];

    if (!sourceClass) throw new AppError(404, 'Source class not found');
    if (!targetClass) throw new AppError(404, 'Target class not found');

    const sourceTeacher = sourceClass.classTeachers.find(
      (teacher) => teacher.teacherId === teacherId,
    );
    if (!sourceTeacher)
      throw new AppError(404, 'Teacher not found in source class');
    if (
      targetClass.classTeachers.some(
        (teacher) => teacher.teacherId === teacherId,
      )
    ) {
      throw new AppError(409, 'Teacher already assigned to target class');
    }

    const transferPlan = ClassTeacherPolicy.planTransfer(
      sourceClass.classTeachers,
      targetClass.classTeachers,
      sourceTeacher,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.classTeacher.deleteMany({
        where: { classId: fromClassId, teacherId },
      });

      if (transferPlan.sourcePromotedTeacherId) {
        await tx.classTeacher.update({
          where: { id: transferPlan.sourcePromotedTeacherId },
          data: { role: 'head_coach' },
        });
      }

      await tx.classTeacher.create({
        data: {
          classId: toClassId,
          teacherId,
          role: transferPlan.targetRole,
        },
      });
    });

    const updatedTarget = (await this.prisma.swimmingClass.findUniqueOrThrow({
      where: { id: toClassId },
      include: classInclude,
    })) as unknown as PrismaClassRecord;

    await this.cache.deleteMatching('classes:list:');
    return PrismaClassMapper.toDomain(updatedTarget);
  }

  async transferStudent(input: TransferStudentRepositoryInput) {
    const { studentId, fromClassId, toClassId } = input;

    const [sourceClass, targetClass, studentClassLink] = await Promise.all([
      this.prisma.swimmingClass.findUnique({
        where: { id: fromClassId },
        include: classInclude,
      }),
      this.prisma.swimmingClass.findUnique({
        where: { id: toClassId },
        include: classInclude,
      }),
      this.prisma.studentClass.findFirst({
        where: { studentId, classId: fromClassId, toDate: null },
        select: { id: true, isPrimary: true },
      }),
    ]);

    if (!sourceClass) throw new AppError(404, 'Source class not found');
    if (!targetClass) throw new AppError(404, 'Target class not found');
    if (!studentClassLink)
      throw new AppError(404, 'Student not found in source class');

    const alreadyInTargetClass = targetClass.studentClasses.some(
      (item) => item.student.id === studentId,
    );
    if (alreadyInTargetClass) {
      throw new AppError(409, 'Student already assigned to target class');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.studentClass.update({
        where: { id: studentClassLink.id },
        data: {
          toDate: new Date(),
          isPrimary: false,
        },
      });

      await tx.studentClass.create({
        data: {
          studentId,
          classId: toClassId,
          isPrimary: true,
        },
      });
    });

    const updatedTarget = (await this.prisma.swimmingClass.findUniqueOrThrow({
      where: { id: toClassId },
      include: classInclude,
    })) as unknown as PrismaClassRecord;

    await this.cache.deleteMatching('classes:list:');
    return PrismaClassMapper.toDomain(updatedTarget);
  }

  async remove(id: string) {
    const existing = (await this.prisma.swimmingClass.findUnique({
      where: { id },
      include: classInclude,
    })) as PrismaClassRecord | null;

    if (!existing) throw new AppError(404, 'Class not found');

    await this.prisma.swimmingClass.delete({
      where: { id },
    });

    await this.cache.deleteMatching('classes:list:');
    return PrismaClassMapper.toDomain(existing);
  }


  private async replaceRelations(
    tx: ClassRelationsTx,
    classId: string,
    categoryIds: string[],
    classTeachers: CreateClassRepositoryInput['classTeachers'],
    schedules: CreateClassRepositoryInput['schedules'],
  ) {
    const existingCategories = await tx.classCategory.findMany({
      where: { classId },
      select: { categoryId: true },
    });
    const existingCategoryIds = new Set(
      existingCategories.map((item) => item.categoryId),
    );
    const missingCategoryIds = categoryIds.filter(
      (categoryId) => !existingCategoryIds.has(categoryId),
    );
    const primaryCategoryId = categoryIds[0];

    if (missingCategoryIds.length > 0) {
      await tx.classCategory.createMany({
        data: missingCategoryIds.map((categoryId) => ({
          classId,
          categoryId,
          isPrimary: categoryId === primaryCategoryId,
        })),
      });
    }

    await tx.classCategory.updateMany({
      where: { classId, categoryId: primaryCategoryId },
      data: { isPrimary: true },
    });

    await tx.classCategory.deleteMany({
      where: { classId, categoryId: { notIn: categoryIds } },
    });

    await Promise.all([
      tx.classTeacher.deleteMany({ where: { classId } }),
      tx.classSchedule.deleteMany({ where: { classId } }),
    ]);

    const normalizedTeachers = ClassTeacherPolicy.normalizeAssignments(classTeachers);

    if (normalizedTeachers.length > 0) {
      await tx.classTeacher.createMany({
        data: normalizedTeachers.map((teacher) => ({
          classId,
          teacherId: teacher.teacherId,
          role: teacher.role,
        })),
      });
    }

    if (schedules.length > 0) {
      await tx.classSchedule.createMany({
        data: schedules.map((schedule) => ({
          classId,
          dayOfWeek: normalizeWeekday(schedule.dayOfWeek) ?? schedule.dayOfWeek,
          startTime: toTimeDate(schedule.startTime),
          endTime: toTimeDate(schedule.endTime),
        })),
      });
    }
  }
}


