import { Injectable } from '@nestjs/common';
import {
  ResultSeasonsRepository,
  type ResultSeasonOption,
  type ResultSeasonOverviewFilters,
  type ResultSeasonOverview,
  type StudentSeasonComposition,
  type WriteResultSeasonInput,
} from '@/domain/results/application/repositories/result-seasons-repository';
import type { PaginationParams } from '@/domain/shared/pagination/pagination-params';
import { getCategoryByBirthYear } from '@/shared/lib/categories';
import {
  formatCategoryLabel,
  parseCategoryValue,
} from '@/shared/utils/domain-formatters';
import type {
  CategoryRolloverPreview,
  CategoryRolloverPreviewRow,
} from '@/domain/results/application/repositories/result-seasons-repository';
import {
  createPaginatedResult,
  normalizePaginationParams,
} from '@/domain/shared/pagination/pagination-utils';
import { AppError } from '@/shared/errors/app-error';
import { PrismaService } from '../prisma.service';

const SEASON_SELECT = {
  id: true,
  year: true,
  label: true,
  startsOn: true,
  endsOn: true,
  status: true,
} as const;

const toSeasonDate = (date: string) => new Date(`${date}T00:00:00.000Z`);

const toSeasonOption = (row: {
  id: string;
  year: number;
  label: string;
  startsOn: Date;
  endsOn: Date;
  status: ResultSeasonOption['status'];
}): ResultSeasonOption => ({
  id: row.id,
  year: row.year,
  label: row.label,
  startsOn: row.startsOn.toISOString().slice(0, 10),
  endsOn: row.endsOn.toISOString().slice(0, 10),
  status: row.status,
});

@Injectable()
export class PrismaResultSeasonsRepository implements ResultSeasonsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(params?: PaginationParams) {
    const { page, perPage } = normalizePaginationParams(params);
    const [rows, total] = await Promise.all([
      this.prisma.season.findMany({
        select: SEASON_SELECT,
        orderBy: [{ year: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.season.count(),
    ]);
    const options = rows.map(toSeasonOption);
    return createPaginatedResult(options, total, { page, perPage });
  }

  async overview(
    id: string,
    filters: ResultSeasonOverviewFilters,
  ): Promise<ResultSeasonOverview> {
    const seasonRow = await this.prisma.season.findUnique({
      where: { id },
      select: SEASON_SELECT,
    });
    if (!seasonRow) throw new AppError(404, 'Season not found');

    const discipline = filters.discipline ?? 'all';
    const includePool = discipline === 'all' || discipline === 'Piscina';
    const includeOpenWater =
      discipline === 'all' || discipline === 'Aguas Abertas';
    const period = {
      gte: seasonRow.startsOn,
      lte: seasonRow.endsOn,
    };
    const selectedEvent = filters.eventId ? { eventId: filters.eventId } : {};
    const eventId = filters.eventId ? { id: filters.eventId } : {};
    const category = filters.category
      ? {
          categorySnapshot: {
            contains: filters.category,
            mode: 'insensitive' as const,
          },
        }
      : {};
    const student = filters.studentSearch
      ? {
          student: {
            name: {
              contains: filters.studentSearch,
              mode: 'insensitive' as const,
            },
          },
        }
      : {};
    const resultFilters = { ...selectedEvent, ...category, ...student };
    const linkedEventWhere = { seasonId: id, ...eventId };
    const raceFilters = {
      event: { seasonId: id, ...eventId },
      ...category,
    };

    // All metrics are database counts; never estimate from a paginated page.
    // Unlinked records are counted only as data-quality alerts for the period.
    const [
      linkedEvents,
      withoutSeasonEvents,
      eventRows,
      poolRaces,
      openWaterRaces,
      poolResults,
      openWaterResults,
      unlinkedPoolResults,
      unlinkedOpenWaterResults,
    ] = await Promise.all([
      this.prisma.event.count({ where: linkedEventWhere }),
      this.prisma.event.count({
        where: { seasonId: null, date: period, ...eventId },
      }),
      this.prisma.event.findMany({
        where: { seasonId: id },
        select: { id: true, title: true, date: true },
        orderBy: [{ date: 'desc' }, { id: 'asc' }],
        take: 61,
      }),
      includePool
        ? this.prisma.poolProgramRace.count({ where: raceFilters })
        : Promise.resolve(0),
      includeOpenWater
        ? this.prisma.openWaterProgramRace.count({ where: raceFilters })
        : Promise.resolve(0),
      includePool
        ? this.prisma.poolResult.count({
            where: { seasonId: id, ...resultFilters },
          })
        : Promise.resolve(0),
      includeOpenWater
        ? this.prisma.openWaterResult.count({
            where: { seasonId: id, ...resultFilters },
          })
        : Promise.resolve(0),
      includePool
        ? this.prisma.poolResult.count({
            where: {
              seasonId: null,
              heldOn: period,
              ...resultFilters,
            },
          })
        : Promise.resolve(0),
      includeOpenWater
        ? this.prisma.openWaterResult.count({
            where: {
              seasonId: null,
              heldOn: period,
              ...resultFilters,
            },
          })
        : Promise.resolve(0),
    ]);

    return {
      season: toSeasonOption(seasonRow),
      filters: { ...filters, discipline },
      events: {
        linked: linkedEvents,
        withoutSeasonInPeriod: withoutSeasonEvents,
        options: eventRows.slice(0, 60).map((event) => ({
          id: event.id,
          title: event.title,
          date: event.date?.toISOString().slice(0, 10) ?? null,
        })),
        optionsTruncated: eventRows.length > 60,
      },
      races: { pool: poolRaces, openWater: openWaterRaces },
      results: {
        pool: poolResults,
        openWater: openWaterResults,
        poolWithoutSeasonInPeriod: unlinkedPoolResults,
        openWaterWithoutSeasonInPeriod: unlinkedOpenWaterResults,
      },
    };
  }

  async studentComposition(id: string): Promise<StudentSeasonComposition> {
    const season = await this.prisma.season.findUnique({
      where: { id },
      select: SEASON_SELECT,
    });
    if (!season) throw new AppError(404, 'Season not found');

    // All counts are DISTINCT by student through the Student table.
    // No reliance on current enrollment, current category, or current status.
    const [
      categoriesRegistered,
      distinct,
      pool,
      openWater,
      enrolledDuringPeriod,
    ] = await Promise.all([
      this.prisma.student.count({
        where: { seasonCategories: { some: { seasonId: id } } },
      }),
      this.prisma.student.count({
        where: {
          OR: [
            { poolResults: { some: { seasonId: id } } },
            { openWaterResults: { some: { seasonId: id } } },
          ],
        },
      }),
      this.prisma.student.count({
        where: { poolResults: { some: { seasonId: id } } },
      }),
      this.prisma.student.count({
        where: { openWaterResults: { some: { seasonId: id } } },
      }),
      this.prisma.student.count({
        where: {
          studentClasses: {
            some: {
              fromDate: { lte: season.endsOn },
              OR: [{ toDate: null }, { toDate: { gte: season.startsOn } }],
            },
          },
        },
      }),
    ]);

    return {
      season: toSeasonOption(season),
      categoriesRegistered,
      participants: { distinct, pool, openWater },
      enrolledDuringPeriod,
    };
  }

  /**
   * Read-only preview: source is the latest real ACTIVE/CLOSED season before
   * target; never infer a historical association from the calendar year.
   */
  async categoryRolloverPreview(
    id: string,
    params: { page: number; perPage: number },
  ): Promise<CategoryRolloverPreview> {
    const target = await this.prisma.season.findUnique({
      where: { id },
      select: SEASON_SELECT,
    });
    if (!target) throw new AppError(404, 'Target season not found');
    if (target.status !== 'PLANNED') {
      throw new AppError(
        409,
        'Category rollover preview requires a planned season',
      );
    }

    const source = await this.prisma.season.findFirst({
      where: {
        year: { lt: target.year },
        status: { in: ['ACTIVE', 'CLOSED'] },
      },
      orderBy: { year: 'desc' },
      select: SEASON_SELECT,
    });
    if (!source)
      throw new AppError(409, 'No eligible previous season was found');

    const where = { seasonId: source.id };
    const [total, sourceRows, catalog] = await Promise.all([
      this.prisma.studentSeasonCategory.count({ where }),
      this.prisma.studentSeasonCategory.findMany({
        where,
        select: {
          studentId: true,
          student: { select: { name: true, birthDate: true, status: true } },
          category: { select: { id: true, name: true } },
        },
        orderBy: [{ student: { name: 'asc' } }, { studentId: 'asc' }],
        skip: (params.page - 1) * params.perPage,
        take: params.perPage,
      }),
      this.prisma.category.findMany({
        select: { id: true, name: true },
      }),
    ]);

    const studentIds = sourceRows.map((row) => row.studentId);
    const targetLinks = studentIds.length
      ? await this.prisma.studentSeasonCategory.findMany({
          where: { seasonId: target.id, studentId: { in: studentIds } },
          select: {
            studentId: true,
            category: { select: { id: true, name: true } },
          },
        })
      : [];
    const targetCategoryByStudent = new Map(
      targetLinks.map((row) => [row.studentId, row.category]),
    );

    const resultWhere = {
      studentId: { in: studentIds },
      OR: [{ seasonId: target.id }, { event: { is: { seasonId: target.id } } }],
    };
    const [poolRows, openWaterRows] = studentIds.length
      ? await Promise.all([
          this.prisma.poolResult.findMany({
            where: resultWhere,
            select: { studentId: true },
            distinct: ['studentId'],
          }),
          this.prisma.openWaterResult.findMany({
            where: resultWhere,
            select: { studentId: true },
            distinct: ['studentId'],
          }),
        ])
      : [[], []];
    const protectedIds = new Set([
      ...poolRows.map((row) => row.studentId),
      ...openWaterRows.map((row) => row.studentId),
    ]);
    const catalogByName = new Map<string, { id: string; name: string }>(
      catalog.map((item) => [item.name, item]),
    );

    const items: CategoryRolloverPreviewRow[] = sourceRows.map((row) => {
      const warnings: CategoryRolloverPreviewRow['warnings'] = [];
      let suggestedCategory: CategoryRolloverPreviewRow['suggestedCategory'] =
        null;
      if (!row.student.birthDate) {
        warnings.push('MISSING_BIRTH_DATE');
      } else {
        try {
          const birthYear = row.student.birthDate.getUTCFullYear();
          const name = parseCategoryValue(
            getCategoryByBirthYear(birthYear, target.year),
          );
          const matched = catalogByName.get(name);
          if (matched) {
            suggestedCategory = {
              id: matched.id,
              name: formatCategoryLabel(matched.name),
            };
            if (
              name === 'Senior' ||
              name === 'Pre_Master' ||
              name.startsWith('Master_')
            ) {
              warnings.push('SENIOR_MASTER_REVIEW');
            }
          } else {
            warnings.push('CATEGORY_NOT_IN_CATALOG');
          }
        } catch {
          warnings.push('INVALID_BIRTH_YEAR');
        }
      }
      const existing = targetCategoryByStudent.get(row.studentId);
      if (existing) warnings.push('TARGET_ALREADY_ASSIGNED');
      if (protectedIds.has(row.studentId)) warnings.push('TARGET_HAS_RESULTS');
      return {
        studentId: row.studentId,
        studentName: row.student.name,
        studentStatus: row.student.status,
        sourceCategory: {
          id: row.category.id,
          name: formatCategoryLabel(row.category.name),
        },
        suggestedCategory,
        existingTargetCategory: existing
          ? { id: existing.id, name: formatCategoryLabel(existing.name) }
          : null,
        warnings,
      };
    });

    return {
      source: toSeasonOption(source),
      target: toSeasonOption(target),
      items,
      meta: {
        page: params.page,
        perPage: params.perPage,
        total,
        totalPages: Math.ceil(total / params.perPage),
      },
      readOnly: true,
    };
  }

  private async assertNoOverlap(
    input: WriteResultSeasonInput,
    excludeId?: string,
  ): Promise<void> {
    const conflict = await this.prisma.season.findFirst({
      where: {
        startsOn: { lte: toSeasonDate(input.endsOn) },
        endsOn: { gte: toSeasonDate(input.startsOn) },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (conflict) {
      throw new AppError(409, 'Season dates overlap with another season');
    }
  }

  async create(input: WriteResultSeasonInput): Promise<ResultSeasonOption> {
    await this.assertNoOverlap(input);
    const season = await this.prisma.season.create({
      data: {
        year: input.year,
        label: input.label,
        startsOn: toSeasonDate(input.startsOn),
        endsOn: toSeasonDate(input.endsOn),
        status: input.status,
      },
      select: SEASON_SELECT,
    });
    return toSeasonOption(season);
  }

  async update(
    id: string,
    input: WriteResultSeasonInput,
  ): Promise<ResultSeasonOption> {
    const existing = await this.prisma.season.findUnique({
      where: { id },
      select: {
        year: true,
        startsOn: true,
        endsOn: true,
        _count: {
          select: {
            studentCategories: true,
            events: true,
            poolResults: true,
            openWaterResults: true,
          },
        },
      },
    });
    if (!existing) throw new AppError(404, 'Season not found');

    const yearChanged = existing.year !== input.year;
    const periodChanged =
      existing.startsOn.toISOString().slice(0, 10) !== input.startsOn ||
      existing.endsOn.toISOString().slice(0, 10) !== input.endsOn;

    const linked =
      existing._count.studentCategories +
        existing._count.events +
        existing._count.poolResults +
        existing._count.openWaterResults >
      0;

    if ((yearChanged || periodChanged) && linked) {
      throw new AppError(
        409,
        'Season year and dates cannot change while records are linked',
      );
    }

    if (periodChanged) await this.assertNoOverlap(input, id);

    const season = await this.prisma.season.update({
      where: { id },
      data: {
        year: input.year,
        label: input.label,
        startsOn: toSeasonDate(input.startsOn),
        endsOn: toSeasonDate(input.endsOn),
        status: input.status,
      },
      select: SEASON_SELECT,
    });
    return toSeasonOption(season);
  }
}
