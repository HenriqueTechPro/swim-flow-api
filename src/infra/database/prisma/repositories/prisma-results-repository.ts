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
import type { GenerateRankingRequest } from '@/domain/results/application/dtos/result-ranking';
import {
  ResultsRepository,
  type CreateResultRepositoryInput,
  type ResultCompetitionContext,
  type ResultEvolutionParams,
  type ResultFilterOptions,
  type ResultStyleDistributionItem,
  type ListResultsRepositoryParams,
  type ResultsEvolution,
  type ResultsSummary,
  type UpdateResultRepositoryInput,
} from '@/domain/results/application/repositories/results-repository';
import { buildResultCompetitionContext } from '@/domain/results/application/services/result-competition-context';
import { AppError } from '@/shared/errors/app-error';
import { normalizeDurationString, parseDuration } from '@/shared/utils/duration';
import type { Result } from '@/domain/results/enterprise/entities/result';
import { PrismaService } from '../prisma.service';
import {
  PrismaResultMapper,
  type PrismaResultRecord,
} from '../mappers/prisma-result-mapper';

const resultInclude = {
  student: {
    select: {
      name: true,
    },
  },
};

const normalizeResultTime = (time: string) => {
  const parsed = parseDuration(time);

  if (!parsed) {
    throw new AppError(400, 'Invalid result duration');
  }

  return {
    time: normalizeDurationString(time) ?? time,
    timeInSeconds: parsed.totalSeconds,
  };
};

const normalizeCourseType = (value?: string) => {
  if (!value) return '';
  if (value === 'Piscina Curta (25m)') return 'Piscina Curta';
  if (value === 'Piscina Longa (50m)') return 'Piscina Longa';
  return value;
};

const normalizeCustomDistance = (value?: string) => value?.trim() || '';

const styleLabels: Record<string, string> = {
  Livre: 'Livre',
  Costas: 'Costas',
  Peito: 'Peito',
  Borboleta: 'Borboleta',
  Medley: 'Medley',
};
const shortMonthLabels = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

const formatMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split('-');
  const monthIndex = Number(month) - 1;
  const monthLabel = shortMonthLabels[monthIndex] || month;

  return `${monthLabel}/${year.slice(-2)}`;
};

const buildResultsWhere = (params?: ListResultsRepositoryParams) => {
  const search = params?.search?.trim();
  const discipline = params?.discipline?.trim();
  const competitionType = params?.competitionType?.trim();
  const courseType = params?.courseType?.trim();
  const style = params?.style?.trim();
  const eventFormat = params?.eventFormat?.trim();
  const resultStatus = params?.resultStatus?.trim();
  const distance = params?.distance?.trim();
  const customDistance = params?.customDistance?.trim();
  const competition = params?.competition?.trim();
  const category = params?.category?.trim();
  const startDate = params?.startDate?.trim();
  const endDate = params?.endDate?.trim();
  const studentId = params?.studentId?.trim();

  const andConditions: Record<string, unknown>[] = [];

  if (search) {
    andConditions.push({
      OR: [
        { student: { name: { contains: search, mode: 'insensitive' } } },
        { style: { contains: search, mode: 'insensitive' } },
        { distance: { contains: search, mode: 'insensitive' } },
        { customDistance: { contains: search, mode: 'insensitive' } },
        { competition: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  if (discipline) andConditions.push({ discipline });
  if (competitionType) andConditions.push({ competitionType });

  if (courseType) {
    andConditions.push({ courseType: normalizeCourseType(courseType) });
  }

  if (style) andConditions.push({ style });
  if (eventFormat) andConditions.push({ eventFormat });
  if (resultStatus) andConditions.push({ resultStatus });

  if (distance) {
    andConditions.push({
      OR: [{ distance }, { customDistance: normalizeCustomDistance(distance) }],
    });
  }

  if (customDistance) {
    andConditions.push({ customDistance: normalizeCustomDistance(customDistance) });
  }

  if (competition) andConditions.push({ competition });
  if (category) andConditions.push({ category });
  if (studentId) andConditions.push({ studentId });

  if (startDate || endDate) {
    const dateFilter: Record<string, Date> = {};

    if (startDate) {
      dateFilter.gte = new Date(`${startDate}T00:00:00.000Z`);
    }

    if (endDate) {
      dateFilter.lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    andConditions.push({ date: dateFilter });
  }

  return andConditions.length > 0 ? { AND: andConditions } : {};
};

@Injectable()
export class PrismaResultsRepository implements ResultsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheRepository,
    private readonly env: EnvService,
  ) {}

  async list(params?: ListResultsRepositoryParams) {
    const { page, perPage } = normalizePaginationParams(params);
    const search = params?.search?.trim();
    const discipline = params?.discipline?.trim();
    const competitionType = params?.competitionType?.trim();
    const courseType = params?.courseType?.trim();
    const style = params?.style?.trim();
    const eventFormat = params?.eventFormat?.trim();
    const resultStatus = params?.resultStatus?.trim();
    const distance = params?.distance?.trim();
    const customDistance = params?.customDistance?.trim();
    const competition = params?.competition?.trim();
    const category = params?.category?.trim();
    const startDate = params?.startDate?.trim();
    const endDate = params?.endDate?.trim();
    const studentId = params?.studentId?.trim();
    const cacheKey = `${buildPaginatedCacheKey('results', page, perPage)}:${search ?? ''}:${discipline ?? ''}:${competitionType ?? ''}:${courseType ?? ''}:${style ?? ''}:${eventFormat ?? ''}:${resultStatus ?? ''}:${distance ?? ''}:${customDistance ?? ''}:${competition ?? ''}:${category ?? ''}:${startDate ?? ''}:${endDate ?? ''}:${studentId ?? ''}`;

    return rememberPaginatedResult(
      this.cache,
      cacheKey,
      this.env.cacheTtlSeconds,
      async () => {
        const skip = (page - 1) * perPage;
        const where = buildResultsWhere(params);

        const [results, total] = await this.prisma.$transaction([
          this.prisma.result.findMany({
            where,
            include: resultInclude,
            orderBy: { date: 'desc' },
            skip,
            take: perPage,
          }),
          this.prisma.result.count({ where }),
        ]);

        return createPaginatedResult(
          (results as unknown as PrismaResultRecord[]).map(
            PrismaResultMapper.toDomain,
          ),
          total,
          { page, perPage },
        );
      },
    );
  }

  async summary(params?: ListResultsRepositoryParams): Promise<ResultsSummary> {
    const now = new Date();
    const lastMonth = new Date(now);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const results = await this.prisma.result.findMany({
      where: buildResultsWhere(params),
      select: {
        discipline: true,
        personalBest: true,
        improvement: true,
        resultStatus: true,
        date: true,
      },
    });

    return {
      totalResults: results.length,
      personalBests: results.filter((result) => result.personalBest).length,
      improvements: results.filter((result) => Number(result.improvement) < 0).length,
      lastMonthResults: results.filter((result) => {
        const resultDate = result.date;
        return resultDate instanceof Date && resultDate >= lastMonth;
      }).length,
      poolResults: results.filter(
        (result) => (result.discipline || 'Piscina') === 'Piscina',
      ).length,
      openWaterResults: results.filter(
        (result) => result.discipline === 'Aguas Abertas',
      ).length,
      disqualifiedResults: results.filter(
        (result) => result.resultStatus === 'Desclassificado',
      ).length,
    };
  }

  async listFilterOptions(): Promise<ResultFilterOptions> {
    const [disciplineRows, styleRows, distanceRows, categoryRows, competitionRows, eventFormatRows] =
      await Promise.all([
        this.prisma.result.findMany({
          distinct: ['discipline'],
          select: { discipline: true },
          orderBy: { discipline: 'asc' },
        }),
        this.prisma.result.findMany({
          distinct: ['style'],
          select: { style: true },
          orderBy: { style: 'asc' },
        }),
        this.prisma.result.findMany({
          select: { distance: true, customDistance: true },
          where: {
            OR: [{ distance: { not: '' } }, { customDistance: { not: '' } }],
          },
          orderBy: { distance: 'asc' },
        }),
        this.prisma.result.findMany({
          distinct: ['category'],
          select: { category: true },
          where: { category: { not: '' } },
          orderBy: { category: 'asc' },
        }),
        this.prisma.result.findMany({
          distinct: ['competition'],
          select: { competition: true },
          where: { competition: { not: '' } },
          orderBy: { competition: 'asc' },
        }),
        this.prisma.result.findMany({
          distinct: ['eventFormat'],
          select: { eventFormat: true },
          where: { eventFormat: { not: '' } },
          orderBy: { eventFormat: 'asc' },
        }),
      ]);

    return {
      disciplines: disciplineRows
        .map((row) => row.discipline)
        .filter((value): value is string => Boolean(value)),
      styles: styleRows.map((row) => row.style).filter(Boolean),
      distances: Array.from(
        new Set(
          distanceRows
            .map((row) => normalizeCustomDistance(row.customDistance) || row.distance)
            .filter(Boolean),
        ),
      ).sort((left, right) =>
        left.localeCompare(right, 'pt-BR', { numeric: true }),
      ),
      categories: categoryRows.map((row) => row.category).filter(Boolean),
      competitions: competitionRows
        .map((row) => row.competition)
        .filter(Boolean),
      eventFormats: eventFormatRows
        .map((row) => row.eventFormat)
        .filter(Boolean),
    };
  }

  async listCompetitionContexts(
    params?: ListResultsRepositoryParams,
  ): Promise<ResultCompetitionContext[]> {
    const results = await this.prisma.result.findMany({
      where: {
        ...buildResultsWhere(params),
        resultStatus: 'Classificado',
        timeInSeconds: { gt: 0 },
      },
      include: resultInclude,
      orderBy: [
        { style: 'asc' },
        { distance: 'asc' },
        { customDistance: 'asc' },
        { category: 'asc' },
      ],
    });

    const uniqueContexts = new Map<string, ResultCompetitionContext>();

    for (const record of results as unknown as PrismaResultRecord[]) {
      const context = buildResultCompetitionContext(
        PrismaResultMapper.toDomain(record),
      );

      if (!uniqueContexts.has(context.key)) {
        uniqueContexts.set(context.key, context);
      }
    }

    return Array.from(uniqueContexts.values()).sort((left, right) => {
      const labelComparison = left.label.localeCompare(right.label, 'pt-BR', {
        numeric: true,
      });

      if (labelComparison !== 0) {
        return labelComparison;
      }

      return left.subtitle.localeCompare(right.subtitle, 'pt-BR');
    });
  }

  async getStyleDistribution(
    params?: ListResultsRepositoryParams,
  ): Promise<ResultStyleDistributionItem[]> {
    const grouped = await this.prisma.result.groupBy({
      by: ['style'],
      where: buildResultsWhere(params),
      _count: { style: true },
      orderBy: { style: 'asc' },
    });

    return grouped
      .filter((item) => Boolean(item.style))
      .map((item) => ({
        style: item.style,
        label: styleLabels[item.style] || item.style,
        count: item._count.style,
      }));
  }

  async getEvolution(params?: ResultEvolutionParams): Promise<ResultsEvolution> {
    const chartStartDate = params?.chartStartDate?.trim();
    const chartEndDate = params?.chartEndDate?.trim();

    const results = await this.prisma.result.findMany({
      where: {
        ...buildResultsWhere(params),
        resultStatus: 'Classificado',
        timeInSeconds: { gt: 0 },
      },
      include: resultInclude,
      orderBy: [{ date: 'asc' }, { studentId: 'asc' }],
    });

    const dateFilteredResults = (results as unknown as PrismaResultRecord[])
      .map(PrismaResultMapper.toDomain)
      .filter((result) => {
        if (chartStartDate && result.date < chartStartDate) return false;
        if (chartEndDate && result.date > chartEndDate) return false;
        return true;
      });

    const studentMap = new Map<
      string,
      { studentId: string; studentName: string; resultCount: number }
    >();

    for (const result of dateFilteredResults) {
      const existing = studentMap.get(result.studentId);

      if (existing) {
        existing.resultCount += 1;
        continue;
      }

      studentMap.set(result.studentId, {
        studentId: result.studentId,
        studentName: result.studentName,
        resultCount: 1,
      });
    }

    const focusedResults = params?.focusStudentId
      ? dateFilteredResults.filter(
          (result) => result.studentId === params.focusStudentId,
        )
      : dateFilteredResults;

    const groupedByMonth = new Map<
      string,
      Map<string, { studentId: string; studentName: string; bestTimeSeconds: number }>
    >();

    for (const result of focusedResults) {
      const monthKey = result.date.slice(0, 7);
      const monthGroup = groupedByMonth.get(monthKey) ?? new Map();
      const existing = monthGroup.get(result.studentId);

      if (!existing || result.timeInSeconds < existing.bestTimeSeconds) {
        monthGroup.set(result.studentId, {
          studentId: result.studentId,
          studentName: result.studentName,
          bestTimeSeconds: result.timeInSeconds,
        });
      }

      groupedByMonth.set(monthKey, monthGroup);
    }

    const points = Array.from(groupedByMonth.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([monthKey, values]) => {
        return {
          monthKey,
          monthLabel: formatMonthLabel(monthKey),
          values: Array.from(values.values()).sort((left, right) =>
            left.studentName.localeCompare(right.studentName, 'pt-BR'),
          ),
        };
      });

    return {
      students: Array.from(studentMap.values()).sort((left, right) =>
        left.studentName.localeCompare(right.studentName, 'pt-BR'),
      ),
      points,
    };
  }

  async listRankingCandidates(input: GenerateRankingRequest): Promise<Result[]> {
    const results = await this.prisma.result.findMany({
      where: {
        discipline: input.discipline,
        competitionType: input.competitionType,
        courseType: normalizeCourseType(input.courseType),
        style: input.style,
        distance: input.distance,
        customDistance: normalizeCustomDistance(input.customDistance),
        eventFormat: input.eventFormat,
        category: input.category,
        resultStatus: 'Classificado',
      },
      include: resultInclude,
      orderBy: [
        { timeInSeconds: 'asc' },
        { date: 'asc' },
        { studentId: 'asc' },
      ],
    });

    return (results as unknown as PrismaResultRecord[]).map(
      PrismaResultMapper.toDomain,
    );
  }

  async listRecordCandidates(
    params?: ListResultsRepositoryParams,
  ): Promise<Result[]> {
    const results = await this.prisma.result.findMany({
      where: buildResultsWhere(params),
      include: resultInclude,
      orderBy: [
        { timeInSeconds: 'asc' },
        { date: 'asc' },
        { studentId: 'asc' },
      ],
    });

    return (results as unknown as PrismaResultRecord[]).map(
      PrismaResultMapper.toDomain,
    );
  }

  async create(input: CreateResultRepositoryInput) {
    const student = await this.prisma.student.findUnique({
      where: { id: input.studentId },
      select: { id: true, categoryLabel: true },
    });

    if (!student) {
      throw new AppError(404, 'Student not found');
    }

    const duration = normalizeResultTime(input.time);

    const result = await this.prisma.result.create({
      data: {
        studentId: input.studentId,
        discipline: input.discipline,
        style: input.style,
        distance: input.distance,
        customDistance: normalizeCustomDistance(input.customDistance),
        competitionType: input.competitionType,
        courseType: normalizeCourseType(input.courseType),
        eventFormat: input.eventFormat,
        time: duration.time,
        timeInSeconds: duration.timeInSeconds,
        date: new Date(input.date),
        competition: input.competition || '',
        position: input.position ?? 0,
        resultStatus: input.resultStatus,
        personalBest: false,
        improvement: 0,
        category: input.category || student.categoryLabel || '',
        notes: input.notes || null,
      },
      include: resultInclude,
    });

    await this.cache.deleteMatching('results:list:');
    return PrismaResultMapper.toDomain(result as unknown as PrismaResultRecord);
  }

  async update(id: string, input: UpdateResultRepositoryInput) {
    const existing = await this.prisma.result.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError(404, 'Result not found');
    }

    const duration = normalizeResultTime(input.time);

    const result = await this.prisma.result.update({
      where: { id },
      data: {
        studentId: input.studentId,
        discipline: input.discipline,
        style: input.style,
        distance: input.distance,
        customDistance: normalizeCustomDistance(input.customDistance),
        competitionType: input.competitionType,
        courseType: normalizeCourseType(input.courseType),
        eventFormat: input.eventFormat,
        time: duration.time,
        timeInSeconds: duration.timeInSeconds,
        date: new Date(input.date),
        competition: input.competition || '',
        position: input.position ?? 0,
        resultStatus: input.resultStatus,
        personalBest: input.personalBest,
        improvement: input.improvement,
        category: input.category || '',
        notes: input.notes || null,
      },
      include: resultInclude,
    });

    await this.cache.deleteMatching('results:list:');
    return PrismaResultMapper.toDomain(result as unknown as PrismaResultRecord);
  }

  async remove(id: string) {
    const existing = await this.prisma.result.findUnique({
      where: { id },
      include: resultInclude,
    });

    if (!existing) {
      throw new AppError(404, 'Result not found');
    }

    await this.prisma.result.delete({
      where: { id },
    });

    await this.cache.deleteMatching('results:list:');
    return PrismaResultMapper.toDomain(
      existing as unknown as PrismaResultRecord,
    );
  }
}
