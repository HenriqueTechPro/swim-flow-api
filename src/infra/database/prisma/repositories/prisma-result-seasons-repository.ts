import { Injectable } from '@nestjs/common';
import {
  ResultSeasonsRepository,
  type ResultSeasonOption,
} from '@/domain/results/application/repositories/result-seasons-repository';
import type { PaginationParams } from '@/domain/shared/pagination/pagination-params';
import {
  createPaginatedResult,
  normalizePaginationParams,
} from '@/domain/shared/pagination/pagination-utils';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaResultSeasonsRepository implements ResultSeasonsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(params?: PaginationParams) {
    const { page, perPage } = normalizePaginationParams(params);
    const [rows, total] = await Promise.all([
      this.prisma.season.findMany({
        select: {
          id: true,
          year: true,
          label: true,
          startsOn: true,
          endsOn: true,
          status: true,
        },
        orderBy: [{ year: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.season.count(),
    ]);
    const options: ResultSeasonOption[] = rows.map((row) => ({
      id: row.id,
      year: row.year,
      label: row.label,
      startsOn: row.startsOn.toISOString().slice(0, 10),
      endsOn: row.endsOn.toISOString().slice(0, 10),
      status: row.status,
    }));
    return createPaginatedResult(options, total, { page, perPage });
  }
}
