import { Injectable } from '@nestjs/common';
import type { ExStudentExitReason as PrismaExStudentExitReason, Prisma } from '@prisma/client';
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
import { formatCategoryLabel } from '@/shared/utils/domain-formatters';
import { PrismaService } from '../prisma.service';
import { retryRolledBackTransaction } from '../retry-transaction';
import {
  EX_STUDENT_EXIT_REASON_LABELS,
  PrismaExStudentMapper,
  toPrismaExStudentExitReason,
} from '../mappers/prisma-ex-student-mapper';

function parseDateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(422, 'Invalid exit date');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value || value > new Date().toISOString().slice(0, 10)) {
    throw new AppError(422, 'Invalid exit date');
  }
  return date;
}

const activeDepartureFilter = {
  reactivatedAt: null,
  voidedAt: null,
} as const;

const normalizeSearchTerm = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const buildMatchingExitReasons = (search?: string): PrismaExStudentExitReason[] => {
  if (!search) return [];
  const normalized = normalizeSearchTerm(search);
  return EX_STUDENT_EXIT_REASON_LABELS.filter((reason) =>
    normalizeSearchTerm(reason).includes(normalized),
  ).map(toPrismaExStudentExitReason);
};

@Injectable()
export class PrismaExStudentsRepository implements ExStudentsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheRepository,
    private readonly env: EnvService,
  ) {}

  private async clearStudentArchiveCaches() {
    await Promise.all([
      this.cache.deleteMatching('ex-students:list:'),
      this.cache.deleteMatching('students:list:'),
    ]);
  }

  async list(params?: ListExStudentsRepositoryParams) {
    const { page, perPage } = normalizePaginationParams(params);
    const search = params?.search?.trim();
    const category = params?.category?.trim();
    const studentId = params?.studentId;
    const includeHistory = params?.includeHistory === true;
    const cacheKey = `${buildPaginatedCacheKey('ex-students', page, perPage)}:${search ?? ''}:${category ?? ''}:${studentId ?? ''}:${includeHistory}`;

    return rememberPaginatedResult(
      this.cache,
      cacheKey,
      this.env.cacheTtlSeconds,
      async () => {
        const searchFilters: Prisma.ExStudentWhereInput[] = search
          ? [
              { name: { contains: search, mode: 'insensitive' } },
              { lastCompetition: { contains: search, mode: 'insensitive' } },
              ...(
                buildMatchingExitReasons(search).length > 0
                  ? [{ exitReason: { in: buildMatchingExitReasons(search) } } as Prisma.ExStudentWhereInput]
                  : []
              ),
            ]
          : [];
        const where: Prisma.ExStudentWhereInput = {
          ...(!includeHistory ? activeDepartureFilter : {}),
          ...(studentId ? { studentId } : {}),
          ...(category ? { category } : {}),
          ...(search ? { OR: searchFilters } : {}),
        };
        const [rows, total] = await this.prisma.$transaction([
          this.prisma.exStudent.findMany({
            where,
            orderBy: [{ exitDateAt: 'desc' }, { createdAt: 'desc' }],
            skip: (page - 1) * perPage,
            take: perPage,
          }),
          this.prisma.exStudent.count({ where }),
        ]);
        return createPaginatedResult(
          rows.map(PrismaExStudentMapper.toDomain),
          total,
          { page, perPage },
        );
      },
    );
  }

  async summary() {
    const [rows, ids] = await Promise.all([
      this.prisma.exStudent.findMany({
        where: activeDepartureFilter,
        select: { category: true, achievements: true },
      }),
      this.prisma.exStudent.findMany({
        where: activeDepartureFilter,
        select: { studentId: true },
      }),
    ]);
    return {
      total: rows.length,
      categoriesCount: new Set(rows.map((row) => row.category).filter(Boolean)).size,
      totalAchievements: rows.reduce((sum, row) => sum + row.achievements, 0),
      archivedStudentIds: [...new Set(ids.map((row) => row.studentId))],
    };
  }

  async create(input: CreateExStudentRepositoryInput) {
    const exitDateAt = parseDateOnly(input.exitDate);
    const archived = await retryRolledBackTransaction(() => this.prisma.$transaction(async (tx) => {
      const student = await tx.student.findUnique({
        where: { id: input.studentId },
        include: {
          guardians: {
            where: { isPrimary: true },
            select: { parentId: true, parent: { select: { name: true } } },
            take: 1,
          },
          category: { select: { name: true } },
          level: { select: { name: true } },
        },
      });
      if (!student) throw new AppError(404, 'Student not found');

      const active = await tx.exStudent.findFirst({
        where: { studentId: student.id, ...activeDepartureFilter },
        select: { id: true },
      });
      if (active) throw new AppError(409, 'Student already has an active departure');

      // Compare-and-set in the transaction: a repeated or concurrent archive
      // must never create another active departure for an inactive student.
      const changed = await tx.student.updateMany({
        where: { id: student.id, status: { not: 'Inativo' } },
        data: { status: 'Inativo' },
      });
      if (changed.count !== 1) {
        throw new AppError(409, 'Student is already inactive');
      }

      const guardian = student.guardians[0];
      return tx.exStudent.create({
        data: {
          studentId: student.id,
          name: student.name,
          birthDate: student.birthDate,
          category: formatCategoryLabel(student.category.name),
          level: student.level.name,
          responsible: guardian?.parent.name ?? '',
          parentId: guardian?.parentId ?? null,
          phone: student.phone,
          exitDateAt,
          exitReason: toPrismaExStudentExitReason(input.exitReason),
          exitNotes: input.exitNotes?.trim() || null,
          achievements: student.achievements,
          lastCompetition: input.lastCompetition?.trim() || '',
        },
      });
    }));
    await this.clearStudentArchiveCaches();
    return PrismaExStudentMapper.toDomain(archived);
  }

  async update(id: string, input: UpdateExStudentRepositoryInput) {
    const exitDateAt = parseDateOnly(input.exitDate);
    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.exStudent.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, 'Departure not found');
      if (existing.reactivatedAt || existing.voidedAt) {
        throw new AppError(409, 'Historical departures are immutable');
      }
      const changed = await tx.exStudent.updateMany({
        where: { id, ...activeDepartureFilter },
        data: {
          exitDateAt,
          exitReason: toPrismaExStudentExitReason(input.exitReason),
          exitNotes: input.exitNotes?.trim() || null,
          achievements: input.achievements,
          lastCompetition: input.lastCompetition,
        },
      });
      if (changed.count !== 1) {
        throw new AppError(409, 'Departure was closed during update');
      }
      return tx.exStudent.findUniqueOrThrow({ where: { id } });
    });
    await this.clearStudentArchiveCaches();
    return PrismaExStudentMapper.toDomain(updated);
  }

  /**
   * DELETE is a correction of a mistakenly recorded departure, NOT a hard
   * delete. We retain the audit snapshot with voidedAt and restore the student.
   */
  async remove(id: string) {
    const voided = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.exStudent.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, 'Departure not found');
      if (existing.reactivatedAt || existing.voidedAt) {
        throw new AppError(409, 'Historical departures cannot be voided twice');
      }
      const changed = await tx.student.updateMany({
        where: { id: existing.studentId, status: 'Inativo' },
        data: { status: 'Ativo' },
      });
      if (changed.count !== 1) throw new AppError(409, 'Student status conflicts with departure');
      return tx.exStudent.update({
        where: { id },
        data: { voidedAt: new Date() },
      });
    });
    await this.clearStudentArchiveCaches();
    return PrismaExStudentMapper.toDomain(voided);
  }

  async reactivate(id: string) {
    const reactivated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.exStudent.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, 'Departure not found');
      if (existing.reactivatedAt || existing.voidedAt) {
        throw new AppError(409, 'Student departure is already closed');
      }
      const changed = await tx.student.updateMany({
        where: { id: existing.studentId, status: 'Inativo' },
        data: { status: 'Ativo' },
      });
      if (changed.count !== 1) throw new AppError(409, 'Student status conflicts with departure');
      return tx.exStudent.update({
        where: { id },
        data: { reactivatedAt: new Date() },
      });
    });
    await this.clearStudentArchiveCaches();
    return PrismaExStudentMapper.toDomain(reactivated);
  }
}
