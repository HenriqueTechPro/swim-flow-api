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
import {
  StudentsRepository,
  type CreateStudentRepositoryInput,
  type ListStudentsRepositoryParams,
  type StudentReferenceData,
  type UpdateStudentRepositoryInput,
} from '@/domain/students/application/repositories/students-repository';
import { StudentClassAssignmentPolicy } from '@/domain/students/application/services/student-class-assignment-policy';
import { AppError } from '@/shared/errors/app-error';
import { PrismaService } from '../prisma.service';
import {
  PrismaStudentMapper,
  type PrismaStudentRecord,
} from '../mappers/prisma-student-mapper';

const studentInclude = {
  category: { select: { name: true } },
  level: { select: { name: true } },
  parent: { select: { name: true } },
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

  async list(params?: ListStudentsRepositoryParams) {
    const { page, perPage } = normalizePaginationParams(params);
    const normalizedSearch = params?.search?.trim().toLowerCase() || '';
    const normalizedCategory = params?.category?.trim() || '';
    const normalizedStatus = params?.status?.trim() || '';
    const cacheKey = `${buildPaginatedCacheKey('students', page, perPage)}:${normalizedSearch}:${normalizedCategory}:${normalizedStatus}`;

    return rememberPaginatedResult(
      this.cache,
      cacheKey,
      this.env.cacheTtlSeconds,
      async () => {
        const skip = (page - 1) * perPage;
        const where = {
          ...(normalizedCategory ? { categoryLabel: normalizedCategory } : {}),
          ...(normalizedStatus ? { status: normalizedStatus as never } : {}),
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
                    parent: {
                      name: {
                        contains: normalizedSearch,
                        mode: 'insensitive' as const,
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
      },
    );
  }

  async listReferenceData(): Promise<StudentReferenceData> {
    const [categories, levels] = await Promise.all([
      this.prisma.category.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.level.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      categories,
      levels,
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
          parentId: input.parentId || null,
          phone: input.phone,
          photo: input.photo || null,
          status: input.status as never,
          achievements: 0,
        },
      });

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
      await tx.student.update({
        where: { id },
        data: {
          name: input.name,
          gender: input.gender,
          birthDate: new Date(input.birthDate),
          categoryId: input.categoryId,
          levelId: input.levelId,
          parentId: input.parentId || null,
          phone: input.phone,
          photo: input.photo || null,
          status: input.status as never,
        },
      });

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
    return PrismaStudentMapper.toDomain(existing as PrismaStudentRecord);
  }
}