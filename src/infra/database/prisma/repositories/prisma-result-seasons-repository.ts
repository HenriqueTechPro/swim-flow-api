import { Injectable } from '@nestjs/common';
import {
  ResultSeasonsRepository,
  type ResultSeasonOption,
  type WriteResultSeasonInput,
} from '@/domain/results/application/repositories/result-seasons-repository';
import type { PaginationParams } from '@/domain/shared/pagination/pagination-params';
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
