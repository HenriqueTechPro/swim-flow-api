import { Injectable } from '@nestjs/common';
import type {
  OpenWaterBodyType,
  OpenWaterResultFormat,
  PoolResultFormat,
  Prisma,
  RaceResultStatus,
  SwimmingStyle,
} from '@prisma/client';
import { CacheRepository } from '@/infra/cache/cache-repository';
import { EnvService } from '@/infra/env/env.service';
import {
  createPaginatedResult,
  normalizePaginationParams,
} from '@/domain/shared/pagination/pagination-utils';
import type { GenerateRankingRequest } from '@/domain/results/application/dtos/result-ranking';
import {
  ResultsRepository,
  type CreateResultRepositoryInput,
  type ListResultsRepositoryParams,
  type ResultCompetitionContext,
  type ResultEvolutionParams,
  type ResultFilterOptions,
  type ResultStyleDistributionItem,
  type ResultsEvolution,
  type ResultsSummary,
  type UpdateResultRepositoryInput,
} from '@/domain/results/application/repositories/results-repository';
import { buildResultCompetitionContext } from '@/domain/results/application/services/result-competition-context';
import { CompetitiveResultPolicy } from '@/domain/results/application/services/competitive-result.policy';
import { AppError } from '@/shared/errors/app-error';
import { parseDuration } from '@/shared/utils/duration';
import type { Result } from '@/domain/results/enterprise/entities/result';
import { PrismaService } from '../prisma.service';
import {
  PrismaCompetitiveResultMapper,
  resultStudentInclude,
  type PoolRecord,
  type OpenWaterRecord,
} from '../mappers/prisma-competitive-result-mapper';

const STATUS: Record<string, RaceResultStatus> = {
  Classificado: 'CLASSIFIED',
  Desclassificado: 'DISQUALIFIED',
  Pendente: 'PENDING',
  'Não largou': 'DID_NOT_START',
  'Não completou': 'DID_NOT_FINISH',
};
const WATER: Record<string, OpenWaterBodyType> = {
  Mar: 'SEA', Rio: 'RIVER', Lago: 'LAKE', Represa: 'RESERVOIR',
};
const POOL_FORMAT: Record<string, PoolResultFormat> = {
  'Prova Individual': 'INDIVIDUAL', Revezamento: 'RELAY',
};
const WATER_FORMAT: Record<string, OpenWaterResultFormat> = {
  'Prova Individual': 'INDIVIDUAL',
  Revezamento: 'RELAY',
  Travessia: 'TRAVESSIA',
  'Knockout Sprint': 'KNOCKOUT_SPRINT',
  Ultramaratona: 'ULTRAMARATHON',
};
const STYLES: SwimmingStyle[] = ['Livre', 'Costas', 'Peito', 'Borboleta', 'Medley'];
const monthLabels = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function parseMeters(label: string): number {
  const match = /^(\d+(?:[.,]\d+)?)(m|km)$/i.exec(label.trim());
  const amount = match ? Number(match[1].replace(',', '.')) : NaN;
  const meters = amount * (match?.[2].toLowerCase() === 'km' ? 1000 : 1);
  if (!Number.isSafeInteger(meters) || meters <= 0)
    throw new AppError(422, 'Distance must be a positive whole number of meters');
  return meters;
}

function parseDate(value: string, field: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new AppError(422, `Invalid ${field}`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    throw new AppError(422, `Invalid ${field}`);
  return date;
}

function poolMeters(course?: string, explicit?: number): number | null {
  const value =
    explicit !== undefined
      ? explicit
      : course === 'Piscina Curta' || course === 'Piscina Curta (25m)'
        ? 25
        : course === 'Piscina Longa' || course === 'Piscina Longa (50m)'
          ? 50
          : null;
  if (value !== null && (!Number.isFinite(value) || value <= 0))
    throw new AppError(422, 'Pool length must be positive');

  if ((course === 'Piscina Curta' || course === 'Piscina Curta (25m)') && value !== 25)
    throw new AppError(422, 'Pool length conflicts with short-course type');
  if ((course === 'Piscina Longa' || course === 'Piscina Longa (50m)') && value !== 50)
    throw new AppError(422, 'Pool length conflicts with long-course type');
  return value;
}

function dateWhere(start?: string, end?: string) {
  return start || end
    ? {
        heldOn: {
          ...(start ? { gte: parseDate(start, 'startDate') } : {}),
          ...(end ? { lte: parseDate(end, 'endDate') } : {}),
        },
      }
    : {};
}

interface ResultWhere {
  pool: Prisma.PoolResultWhereInput | null;
  openWater: Prisma.OpenWaterResultWhereInput | null;
}

function buildWhere(params?: ListResultsRepositoryParams): ResultWhere {
  const p = params ?? {};
  const discipline = p.discipline?.trim() || p.competitionType?.trim();
  // Conflicting filters never bridge two different modalities.
  if (p.discipline && p.competitionType && p.discipline !== p.competitionType)
    return { pool: null, openWater: null };

  const distanceText = p.customDistance?.trim() || p.distance?.trim();
  const meters = distanceText ? parseMeters(distanceText) : undefined;
  const status = p.resultStatus ? STATUS[p.resultStatus] : undefined;
  const style = p.style && STYLES.includes(p.style as SwimmingStyle)
    ? (p.style as SwimmingStyle)
    : undefined;
  const search = p.search?.trim();

  let pool: Prisma.PoolResultWhereInput | null =
    discipline && discipline !== 'Piscina' ? null : {
      ...dateWhere(p.startDate, p.endDate),
      ...(p.studentId ? { studentId: p.studentId } : {}),
      ...(meters !== undefined ? { distanceMeters: meters } : {}),
      ...(p.category ? { categorySnapshot: p.category } : {}),
      ...(p.competition ? { competitionSnapshot: p.competition } : {}),
      ...(status ? { status } : {}),
      ...(style ? { style } : {}),
      ...(search ? { OR: [
        { student: { name: { contains: search, mode: 'insensitive' } } },
        { competitionSnapshot: { contains: search, mode: 'insensitive' } },
        { categorySnapshot: { contains: search, mode: 'insensitive' } },
      ] } : {}),
    };

  let openWater: Prisma.OpenWaterResultWhereInput | null =
    discipline && discipline !== 'Aguas Abertas' ? null : {
      ...dateWhere(p.startDate, p.endDate),
      ...(p.studentId ? { studentId: p.studentId } : {}),
      ...(meters !== undefined ? { distanceMeters: meters } : {}),
      ...(p.category ? { categorySnapshot: p.category } : {}),
      ...(p.competition ? { competitionSnapshot: p.competition } : {}),
      ...(status ? { status } : {}),
      ...(style ? { style } : {}),
      ...(search ? { OR: [
        { student: { name: { contains: search, mode: 'insensitive' } } },
        { competitionSnapshot: { contains: search, mode: 'insensitive' } },
        { categorySnapshot: { contains: search, mode: 'insensitive' } },
      ] } : {}),
    };

  if (p.style && !style) return { pool: null, openWater: null };
  if (p.resultStatus && !status) return { pool: null, openWater: null };

  if (p.courseType) {
    const value = p.courseType.trim();
    if (!['Piscina Curta', 'Piscina Longa', 'Piscina Curta (25m)', 'Piscina Longa (50m)'].includes(value))
      pool = null;
    else if (pool)
      pool.poolLengthMeters = poolMeters(value);
    if (!WATER[value]) openWater = null;
    else if (openWater) openWater.bodyType = WATER[value];
  }
  if (p.eventFormat) {
    if (!POOL_FORMAT[p.eventFormat]) pool = null;
    else if (pool) pool.format = POOL_FORMAT[p.eventFormat];
    if (!WATER_FORMAT[p.eventFormat]) openWater = null;
    else if (openWater) openWater.format = WATER_FORMAT[p.eventFormat];
  }
  return { pool, openWater };
}

function prepared(input: CreateResultRepositoryInput) {
  const meters = parseMeters(input.customDistance?.trim() || input.distance);
  const heldOn = parseDate(input.date, 'date');
  const parsed = input.time ? parseDuration(input.time) : null;
  if (input.time && !parsed) throw new AppError(422, 'Invalid result time');
  const durationMs = parsed?.totalMilliseconds ?? null;
  const position = input.position && input.position > 0 ? input.position : null;
  const status = STATUS[input.resultStatus];
  if (!status) throw new AppError(422, 'Unknown race status');

  const common = {
    studentId: input.studentId,
    heldOn,
    distanceMeters: meters,
    durationMs,
    position,
    status,
    competitionSnapshot: input.competition?.trim() || null,
    categorySnapshot: input.category?.trim() || null,
    notes: input.notes?.trim() || null,
  };

  if (input.discipline === 'Piscina') {
    const length = poolMeters(input.courseType, input.poolLengthMeters);
    const format = POOL_FORMAT[input.eventFormat];
    if (!format) throw new AppError(422, 'Invalid pool event format');

    CompetitiveResultPolicy.assertValid({
      discipline: 'POOL',
      studentId: input.studentId,
      distanceMeters: meters,
      poolLengthMeters: length,
      style: input.style,
      format,
      status,
      durationMs,
      position,
    });
    return {
      discipline: 'Piscina' as const,
      data: { ...common, style: input.style, format, poolLengthMeters: length },
    };
  }

  const bodyType = input.courseType ? WATER[input.courseType] : undefined;
  if (input.courseType && !bodyType)
    throw new AppError(422, 'Invalid open-water course type');
  const format = WATER_FORMAT[input.eventFormat];
  if (!format) throw new AppError(422, 'Invalid open-water event format');
  const routeKey = input.routeKey?.trim() || null;

  CompetitiveResultPolicy.assertValid({
    discipline: 'OPEN_WATER',
    studentId: input.studentId,
    distanceMeters: meters,
    bodyType: bodyType ?? null,
    routeKey,
    format,
    status,
    durationMs,
    position,
  });

  return {
    discipline: 'Aguas Abertas' as const,
    data: { ...common, style: input.style, format, bodyType: bodyType ?? null, routeKey },
  };
}

function sortResults(left: Result, right: Result) {
  return right.date.localeCompare(left.date) || right.id.localeCompare(left.id);
}

@Injectable()
export class PrismaResultsRepository implements ResultsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheRepository,
    private readonly env: EnvService,
  ) {}

  private async load(params?: ListResultsRepositoryParams): Promise<Result[]> {
    const { pool, openWater } = buildWhere(params);
    const [poolRows, waterRows] = await Promise.all([
      pool ? this.prisma.poolResult.findMany({ where: pool, include: resultStudentInclude }) : Promise.resolve([] as PoolRecord[]),
      openWater ? this.prisma.openWaterResult.findMany({ where: openWater, include: resultStudentInclude }) : Promise.resolve([] as OpenWaterRecord[]),
    ]);
    return [
      ...poolRows.map(PrismaCompetitiveResultMapper.pool),
      ...waterRows.map(PrismaCompetitiveResultMapper.openWater),
    ].sort(sortResults);
  }

  async list(params?: ListResultsRepositoryParams) {
    const { page, perPage } = normalizePaginationParams(params);
    const cacheKey = `results:v2:list:${JSON.stringify({ ...params, page, perPage })}`;
    const { pool, openWater } = buildWhere(params);
    return this.cache.get(cacheKey).then(async (cached) => {
      if (cached) return JSON.parse(cached) as Awaited<ReturnType<PrismaResultsRepository['list']>>;

      // A globally ordered page of a union requires reading at most
      // skip + take from EACH table. Never page each table independently.
      const take = page * perPage;
      const [poolRows, waterRows, poolCount, waterCount] = await Promise.all([
        pool ? this.prisma.poolResult.findMany({
          where: pool, include: resultStudentInclude,
          orderBy: [{ heldOn: 'desc' }, { id: 'desc' }], take,
        }) : Promise.resolve([] as PoolRecord[]),
        openWater ? this.prisma.openWaterResult.findMany({
          where: openWater, include: resultStudentInclude,
          orderBy: [{ heldOn: 'desc' }, { id: 'desc' }], take,
        }) : Promise.resolve([] as OpenWaterRecord[]),
        pool ? this.prisma.poolResult.count({ where: pool }) : Promise.resolve(0),
        openWater ? this.prisma.openWaterResult.count({ where: openWater }) : Promise.resolve(0),
      ]);
      const items = [
        ...poolRows.map(PrismaCompetitiveResultMapper.pool),
        ...waterRows.map(PrismaCompetitiveResultMapper.openWater),
      ].sort(sortResults).slice((page - 1) * perPage, page * perPage);
      const result = createPaginatedResult(items, poolCount + waterCount, { page, perPage });
      await this.cache.set(cacheKey, JSON.stringify(result), this.env.cacheTtlSeconds);
      return result;
    });
  }

  async summary(params?: ListResultsRepositoryParams): Promise<ResultsSummary> {
    const { pool, openWater } = buildWhere(params);
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const [poolCount, waterCount, poolDisqualified, waterDisqualified, poolRecent, waterRecent, poolRecords] =
      await Promise.all([
        pool ? this.prisma.poolResult.count({ where: pool }) : Promise.resolve(0),
        openWater ? this.prisma.openWaterResult.count({ where: openWater }) : Promise.resolve(0),
        pool ? this.prisma.poolResult.count({ where: { AND: [pool, { status: 'DISQUALIFIED' }] } }) : Promise.resolve(0),
        openWater ? this.prisma.openWaterResult.count({ where: { AND: [openWater, { status: 'DISQUALIFIED' }] } }) : Promise.resolve(0),
        pool ? this.prisma.poolResult.count({ where: { AND: [pool, { heldOn: { gte: lastMonth } }] } }) : Promise.resolve(0),
        openWater ? this.prisma.openWaterResult.count({ where: { AND: [openWater, { heldOn: { gte: lastMonth } }] } }) : Promise.resolve(0),
        pool ? this.prisma.poolResult.findMany({
          where: { AND: [pool, { status: 'CLASSIFIED', format: 'INDIVIDUAL', durationMs: { not: null }, poolLengthMeters: { not: null } }] },
          select: { studentId: true, style: true, distanceMeters: true, poolLengthMeters: true, durationMs: true, heldOn: true, id: true },
          orderBy: [{ heldOn: 'asc' }, { id: 'asc' }],
        }) : Promise.resolve([]),
      ]);
    const personalRecords = new Map<string, number>();
    let improvements = 0;
    for (const record of poolRecords) {
      if (record.durationMs === null || record.poolLengthMeters === null) continue;
      const key = [record.studentId, record.style, record.distanceMeters, record.poolLengthMeters.toString()].join(':');
      const best = personalRecords.get(key);
      if (best === undefined || record.durationMs < best) {
        if (best !== undefined) improvements++;
        personalRecords.set(key, record.durationMs);
      }
    }
    return {
      totalResults: poolCount + waterCount,
      poolResults: poolCount,
      openWaterResults: waterCount,
      disqualifiedResults: poolDisqualified + waterDisqualified,
      lastMonthResults: poolRecent + waterRecent,
      personalBests: personalRecords.size,
      improvements,
    };
  }

  async listFilterOptions(): Promise<ResultFilterOptions> {
    const [poolDistances, waterDistances, poolCategories, waterCategories, poolCompetitions, waterCompetitions, poolStyles, waterStyles] = await Promise.all([
      this.prisma.poolResult.findMany({ distinct: ['distanceMeters'], select: { distanceMeters: true } }),
      this.prisma.openWaterResult.findMany({ distinct: ['distanceMeters'], select: { distanceMeters: true } }),
      this.prisma.poolResult.findMany({ distinct: ['categorySnapshot'], select: { categorySnapshot: true } }),
      this.prisma.openWaterResult.findMany({ distinct: ['categorySnapshot'], select: { categorySnapshot: true } }),
      this.prisma.poolResult.findMany({ distinct: ['competitionSnapshot'], select: { competitionSnapshot: true } }),
      this.prisma.openWaterResult.findMany({ distinct: ['competitionSnapshot'], select: { competitionSnapshot: true } }),
      this.prisma.poolResult.findMany({ distinct: ['style'], select: { style: true } }),
      this.prisma.openWaterResult.findMany({ distinct: ['style'], select: { style: true } }),
    ]);
    const unique = (items: Array<string | null | undefined>) =>
      Array.from(new Set(items.filter((item): item is string => !!item))).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
    return {
      disciplines: ['Piscina', 'Aguas Abertas'],
      styles: unique([...poolStyles.map(x => x.style), ...waterStyles.map(x => x.style)]),
      distances: unique([...poolDistances.map(x => `${x.distanceMeters}m`), ...waterDistances.map(x => `${x.distanceMeters}m`)]),
      categories: unique([...poolCategories.map(x => x.categorySnapshot), ...waterCategories.map(x => x.categorySnapshot)]),
      competitions: unique([...poolCompetitions.map(x => x.competitionSnapshot), ...waterCompetitions.map(x => x.competitionSnapshot)]),
      eventFormats: ['Prova Individual', 'Revezamento', 'Travessia', 'Knockout Sprint', 'Ultramaratona'],
    };
  }

  async listCompetitionContexts(params?: ListResultsRepositoryParams): Promise<ResultCompetitionContext[]> {
    const rows = (await this.load({ ...params, resultStatus: 'Classificado' }))
      .filter(x => x.timeInSeconds > 0 && x.discipline === 'Piscina' && x.eventFormat === 'Prova Individual' && x.poolLengthMeters != null);
    const unique = new Map<string, ResultCompetitionContext>();
    for (const record of rows) {
      const context = buildResultCompetitionContext(record);
      if (!unique.has(context.key)) unique.set(context.key, context);
    }
    return [...unique.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR', { numeric: true }));
  }

  async getStyleDistribution(params?: ListResultsRepositoryParams): Promise<ResultStyleDistributionItem[]> {
    const { pool, openWater } = buildWhere(params);
    const [poolGroups, waterGroups] = await Promise.all([
      pool ? this.prisma.poolResult.groupBy({ by: ['style'], where: pool, _count: { _all: true } }) : Promise.resolve([]),
      openWater ? this.prisma.openWaterResult.groupBy({ by: ['style'], where: openWater, _count: { _all: true } }) : Promise.resolve([]),
    ]);
    const counts = new Map<string, number>();
    for (const x of [...poolGroups, ...waterGroups]) {
      const style = x.style ?? 'Nao informado';
      counts.set(style, (counts.get(style) ?? 0) + x._count._all);
    }
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([style, count]) => ({ style, label: style, count }));
  }

  async getEvolution(params?: ResultEvolutionParams): Promise<ResultsEvolution> {
    const empty = { students: [], points: [] };
    // Do not plot incomparable events as if they were the same stroke/distance.
    if (
      params?.discipline === 'Aguas Abertas' ||
      !params?.style || !params.distance || !params.courseType ||
      (params.eventFormat && params.eventFormat !== 'Prova Individual')
    ) return empty;
    const { pool } = buildWhere({
      ...params, discipline: 'Piscina', eventFormat: 'Prova Individual', resultStatus: 'Classificado',
      startDate: params.chartStartDate || params.startDate,
      endDate: params.chartEndDate || params.endDate,
    });
    if (!pool) return empty;
    const rows = await this.prisma.poolResult.findMany({
      where: { AND: [pool, { durationMs: { gt: 0 }, poolLengthMeters: { not: null } }] },
      include: resultStudentInclude,
      orderBy: [{ heldOn: 'asc' }, { id: 'asc' }],
    });
    const students = new Map<string, { studentId: string; studentName: string; resultCount: number }>();
    const months = new Map<string, Map<string, { studentId: string; studentName: string; bestTimeSeconds: number }>>();
    for (const row of rows) {
      const name = row.student.name;
      const item = students.get(row.studentId) ?? { studentId: row.studentId, studentName: name, resultCount: 0 };
      item.resultCount++;
      students.set(row.studentId, item);
      if (params.focusStudentId && params.focusStudentId !== row.studentId) continue;
      if (row.durationMs === null) continue;
      const monthKey = row.heldOn.toISOString().slice(0, 7);
      const month = months.get(monthKey) ?? new Map();
      const prev = month.get(row.studentId);
      if (!prev || row.durationMs / 1000 < prev.bestTimeSeconds)
        month.set(row.studentId, { studentId: row.studentId, studentName: name, bestTimeSeconds: row.durationMs / 1000 });
      months.set(monthKey, month);
    }
    return {
      students: [...students.values()].sort((a, b) => a.studentName.localeCompare(b.studentName, 'pt-BR')),
      points: [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([monthKey, values]) => ({
        monthKey,
        monthLabel: `${monthLabels[Number(monthKey.slice(5, 7)) - 1]}/${monthKey.slice(2, 4)}`,
        values: [...values.values()].sort((a, b) => a.studentName.localeCompare(b.studentName, 'pt-BR')),
      })),
    };
  }

  async listRankingCandidates(input: GenerateRankingRequest): Promise<Result[]> {
    // A water-body label (Mar/Rio/etc.) is NOT enough to compare open-water routes.
    if (input.discipline !== 'Piscina' || input.eventFormat !== 'Prova Individual') return [];
    const { pool } = buildWhere({ ...input, resultStatus: 'Classificado' });
    if (!pool || !input.courseType) return [];
    const rows = await this.prisma.poolResult.findMany({
      where: { AND: [pool, { status: 'CLASSIFIED', format: 'INDIVIDUAL', durationMs: { gt: 0 } }] },
      include: resultStudentInclude,
      orderBy: [{ durationMs: 'asc' }, { heldOn: 'asc' }, { id: 'asc' }],
    });
    return rows.map(PrismaCompetitiveResultMapper.pool);
  }

  async listRecordCandidates(params?: ListResultsRepositoryParams): Promise<Result[]> {
    if (params?.discipline === 'Aguas Abertas') return [];
    const { pool } = buildWhere({ ...params, discipline: 'Piscina', eventFormat: 'Prova Individual', resultStatus: 'Classificado' });
    if (!pool) return [];
    const rows = await this.prisma.poolResult.findMany({
      where: { AND: [pool, { poolLengthMeters: { not: null }, durationMs: { gt: 0 }, status: 'CLASSIFIED' }] },
      include: resultStudentInclude,
      orderBy: [{ durationMs: 'asc' }, { heldOn: 'asc' }, { id: 'asc' }],
    });
    return rows.map(PrismaCompetitiveResultMapper.pool);
  }

  async create(input: CreateResultRepositoryInput): Promise<Result> {
    const row = prepared(input);
    const student = await this.prisma.student.findUnique({ where: { id: input.studentId }, select: { id: true } });
    if (!student) throw new AppError(404, 'Student not found');
    const result = row.discipline === 'Piscina'
      ? PrismaCompetitiveResultMapper.pool(await this.prisma.poolResult.create({ data: row.data, include: resultStudentInclude }))
      : PrismaCompetitiveResultMapper.openWater(await this.prisma.openWaterResult.create({ data: row.data, include: resultStudentInclude }));
    await this.cache.deleteMatching('results:');
    return result;
  }

  async update(id: string, input: UpdateResultRepositoryInput): Promise<Result> {
    const row = prepared(input);
    const [poolOld, waterOld] = await Promise.all([
      this.prisma.poolResult.findUnique({ where: { id }, select: { id: true } }),
      this.prisma.openWaterResult.findUnique({ where: { id }, select: { id: true } }),
    ]);
    if (!poolOld && !waterOld) throw new AppError(404, 'Result not found');
    if ((poolOld && row.discipline !== 'Piscina') || (waterOld && row.discipline !== 'Aguas Abertas'))
      throw new AppError(422, 'Changing result discipline requires recreating the result');
    const result = poolOld && row.discipline === 'Piscina'
      ? PrismaCompetitiveResultMapper.pool(await this.prisma.poolResult.update({ where: { id }, data: row.data, include: resultStudentInclude }))
      : row.discipline === 'Aguas Abertas'
        ? PrismaCompetitiveResultMapper.openWater(await this.prisma.openWaterResult.update({ where: { id }, data: row.data, include: resultStudentInclude }))
        : (() => { throw new AppError(422, 'Invalid result context'); })();
    await this.cache.deleteMatching('results:');
    return result;
  }

  async remove(id: string): Promise<Result> {
    const pool = await this.prisma.poolResult.findUnique({ where: { id }, include: resultStudentInclude });
    if (pool) {
      await this.prisma.poolResult.delete({ where: { id } });
      await this.cache.deleteMatching('results:');
      return PrismaCompetitiveResultMapper.pool(pool);
    }
    const water = await this.prisma.openWaterResult.findUnique({ where: { id }, include: resultStudentInclude });
    if (!water) throw new AppError(404, 'Result not found');
    await this.prisma.openWaterResult.delete({ where: { id } });
    await this.cache.deleteMatching('results:');
    return PrismaCompetitiveResultMapper.openWater(water);
  }
}
