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
  ExStudentsRepository,
  type CreateExStudentRepositoryInput,
  type ListExStudentsRepositoryParams,
  type UpdateExStudentRepositoryInput,
} from '@/domain/ex-students/application/repositories/ex-students-repository';
import { AppError } from '@/shared/errors/app-error';
import { REFERENCE_YEAR } from '@/shared/lib/categories';
import type { ExStudentExitReason as PrismaExStudentExitReason } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  EX_STUDENT_EXIT_REASON_LABELS,
  PrismaExStudentMapper,
  type PrismaExStudentRecord,
  toPrismaExStudentExitReason,
} from '../mappers/prisma-ex-student-mapper';

const getBirthYearFromDate = (birthDate?: Date | null) => {
  if (!birthDate) return REFERENCE_YEAR;
  return Number(birthDate.toISOString().slice(0, 4));
};

const normalizeSearchTerm = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const buildMatchingExitReasons = (search?: string): PrismaExStudentExitReason[] => {
  if (!search) return [];

  const normalizedSearch = normalizeSearchTerm(search);

  return EX_STUDENT_EXIT_REASON_LABELS.filter((reason) =>
    normalizeSearchTerm(reason).includes(normalizedSearch),
  ).map(toPrismaExStudentExitReason);
};

@Injectable()
export class PrismaExStudentsRepository implements ExStudentsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheRepository,
    private readonly env: EnvService,
  ) {}

  async list(params?: ListExStudentsRepositoryParams) {
    const { page, perPage } = normalizePaginationParams(params);
    const search = params?.search?.trim();
    const category = params?.category?.trim();
    const cacheKey = `${buildPaginatedCacheKey('ex-students', page, perPage)}:${search ?? ''}:${category ?? ''}`;

    return rememberPaginatedResult(
      this.cache,
      cacheKey,
      this.env.cacheTtlSeconds,
      async () => {
        const skip = (page - 1) * perPage;
        const matchingExitReasons = buildMatchingExitReasons(search);
        const searchFilters = search
          ? [
              { name: { contains: search, mode: 'insensitive' as const } },
              {
                lastCompetition: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
              ...(matchingExitReasons.length > 0
                ? [{ exitReason: { in: matchingExitReasons } }]
                : []),
            ]
          : [];
        const where = {
          ...(category ? { category: category } : {}),
          ...(search ? { OR: searchFilters } : {}),
        };

        const [exStudents, total] = await this.prisma.$transaction([
          this.prisma.exStudent.findMany({
            where,
            orderBy: { name: 'asc' },
            skip,
            take: perPage,
          }),
          this.prisma.exStudent.count({ where }),
        ]);

        return createPaginatedResult(
          (exStudents as unknown as PrismaExStudentRecord[]).map(
            PrismaExStudentMapper.toDomain,
          ),
          total,
          { page, perPage },
        );
      },
    );
  }

  async summary() {
    const [exStudents, archivedStudentRows] = await Promise.all([
      this.prisma.exStudent.findMany({
        select: {
          category: true,
          achievements: true,
        },
      }),
      this.prisma.exStudent.findMany({
        where: {
          studentId: {
            not: null,
          },
        },
        select: {
          studentId: true,
        },
      }),
    ]);

    return {
      total: exStudents.length,
      categoriesCount: new Set(exStudents.map((item) => item.category).filter(Boolean))
        .size,
      totalAchievements: exStudents.reduce(
        (sum, item) => sum + (item.achievements || 0),
        0,
      ),
      archivedStudentIds: archivedStudentRows
        .map((item) => item.studentId)
        .filter((value): value is string => Boolean(value)),
    };
  }

  async create(input: CreateExStudentRepositoryInput) {
    const existingArchive = await this.prisma.exStudent.findFirst({
      where: { studentId: input.studentId },
      select: { id: true },
    });

    if (existingArchive) {
      throw new AppError(422, 'Este aluno já está com o plano desativado.');
    }

    const student = await this.prisma.student.findUnique({
      where: { id: input.studentId },
      include: {
        parent: {
          select: { name: true },
        },
      },
    });

    if (!student) {
      throw new AppError(404, 'Student not found');
    }

    const birthYear = getBirthYearFromDate(student.birthDate);
    const categorySnapshot = student.categoryLabel || 'Nao Informada';
    const levelSnapshot = student.levelLabel || 'Iniciante';
    const responsible = student.parent?.name || '';

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
          exitDateAt: new Date(input.exitDate),
          exitReason: toPrismaExStudentExitReason(input.exitReason),
          exitNotes: input.exitNotes || null,
          achievements: student.achievements || 0,
          lastCompetition: input.lastCompetition || '',
        },
      });

      await tx.student.update({
        where: { id: student.id },
        data: {
          status: 'Inativo',
        },
      });

      return tx.exStudent.findUniqueOrThrow({
        where: { id: created.id },
      });
    });

    await this.cache.deleteMatching('ex-students:list:');
    return PrismaExStudentMapper.toDomain(
      exStudent as unknown as PrismaExStudentRecord,
    );
  }

  async update(id: string, input: UpdateExStudentRepositoryInput) {
    const existing = await this.prisma.exStudent.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError(404, 'Ex-student not found');
    }

    const exStudent = await this.prisma.exStudent.update({
      where: { id },
      data: {
        exitDateAt: new Date(input.exitDate),
        exitReason: toPrismaExStudentExitReason(input.exitReason),
        exitNotes: input.exitNotes || null,
        achievements: input.achievements,
        lastCompetition: input.lastCompetition,
      },
    });

    await this.cache.deleteMatching('ex-students:list:');
    return PrismaExStudentMapper.toDomain(
      exStudent as unknown as PrismaExStudentRecord,
    );
  }

  async remove(id: string) {
    const existing = await this.prisma.exStudent.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError(404, 'Ex-student not found');
    }

    await this.prisma.exStudent.delete({
      where: { id },
    });

    await this.cache.deleteMatching('ex-students:list:');
    return PrismaExStudentMapper.toDomain(
      existing as unknown as PrismaExStudentRecord,
    );
  }

  async reactivate(id: string) {
    const existing = await this.prisma.exStudent.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError(404, 'Ex-student not found');
    }

    if (!existing.studentId) {
      throw new AppError(
        422,
        'Nao e possivel reativar um ex-aluno sem vinculo com cadastro original.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id: existing.studentId as string },
        data: {
          status: 'Ativo',
        },
      });

      await tx.exStudent.delete({
        where: { id },
      });
    });

    await this.cache.deleteMatching('ex-students:list:');
    return PrismaExStudentMapper.toDomain(
      existing as unknown as PrismaExStudentRecord,
    );
  }
}
