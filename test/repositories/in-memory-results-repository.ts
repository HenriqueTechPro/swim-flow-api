import { AppError } from '@/shared/errors/app-error';
import { normalizeDurationString, parseDuration } from '@/shared/utils/duration';
import type { GenerateRankingRequest } from '@/domain/results/application/dtos/result-ranking';
import type {
  CreateResultRepositoryInput,
  ResultCompetitionContext,
  ResultEvolution,
  ResultEvolutionParams,
  ResultFilterOptions,
  ListResultsRepositoryParams,
  ResultsSummary,
  ResultStyleDistributionItem,
  UpdateResultRepositoryInput,
} from '@/domain/results/application/repositories/results-repository';
import { ResultsRepository } from '@/domain/results/application/repositories/results-repository';
import { buildResultCompetitionContext } from '@/domain/results/application/services/result-competition-context';
import type { Result } from '@/domain/results/enterprise/entities/result';
import { paginateItems } from '@/domain/shared/pagination/pagination-utils';
import { makeResult } from '../factories/make-result';

const normalizeCourseType = (value?: string) => {
  if (!value) return undefined;
  if (value === 'Piscina Curta (25m)') return 'Piscina Curta';
  if (value === 'Piscina Longa (50m)') return 'Piscina Longa';
  return value;
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

export class InMemoryResultsRepository implements ResultsRepository {
  public items: Result[] = [];

  private filterItems(params?: ListResultsRepositoryParams) {
    const search = params?.search?.trim().toLocaleLowerCase('pt-BR');
    const discipline = params?.discipline?.trim();
    const competitionType = params?.competitionType?.trim();
    const courseType = normalizeCourseType(params?.courseType?.trim());
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

    return this.items.filter((item) => {
      if (discipline && item.discipline !== discipline) return false;
      if (competitionType && item.competitionType !== competitionType) return false;
      if (courseType && normalizeCourseType(item.courseType) !== courseType) return false;
      if (style && item.style !== style) return false;
      if (eventFormat && item.eventFormat !== eventFormat) return false;
      if (resultStatus && item.resultStatus !== resultStatus) return false;

      if (distance) {
        const itemDistanceLabel = item.customDistance?.trim() || item.distance;
        if (item.distance !== distance && itemDistanceLabel !== distance) {
          return false;
        }
      }

      if (customDistance && (item.customDistance?.trim() || '') !== customDistance) {
        return false;
      }

      if (competition && item.competition !== competition) return false;
      if (category && item.category !== category) return false;
      if (studentId && item.studentId !== studentId) return false;
      if (startDate && item.date < startDate) return false;
      if (endDate && item.date > endDate) return false;

      if (!search) return true;

      const searchableFields = [
        item.studentName,
        item.discipline,
        item.competitionType,
        item.courseType,
        item.style,
        item.distance,
        item.customDistance,
        item.eventFormat,
        item.competition,
        item.category,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pt-BR');

      return searchableFields.includes(search);
    });
  }

  async list(params?: ListResultsRepositoryParams) {
    const filteredItems = this.filterItems(params);
    return paginateItems(filteredItems, params);
  }

  async summary(params?: ListResultsRepositoryParams): Promise<ResultsSummary> {
    const filteredItems = this.filterItems(params);
    const now = new Date();
    const lastMonth = new Date(now);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    return {
      totalResults: filteredItems.length,
      personalBests: filteredItems.filter((item) => item.personalBest).length,
      improvements: filteredItems.filter((item) => item.improvement < 0).length,
      lastMonthResults: filteredItems.filter(
        (item) => new Date(item.date) >= lastMonth,
      ).length,
      poolResults: filteredItems.filter(
        (item) => (item.discipline || 'Piscina') === 'Piscina',
      ).length,
      openWaterResults: filteredItems.filter(
        (item) => item.discipline === 'Aguas Abertas',
      ).length,
      disqualifiedResults: filteredItems.filter(
        (item) => item.resultStatus === 'Desclassificado',
      ).length,
    };
  }

  async listFilterOptions(): Promise<ResultFilterOptions> {
    return {
      disciplines: Array.from(
        new Set(this.items.map((item) => item.discipline).filter(Boolean)),
      ).sort((left, right) => left.localeCompare(right, 'pt-BR')),
      styles: Array.from(
        new Set(this.items.map((item) => item.style).filter(Boolean)),
      ).sort((left, right) => left.localeCompare(right, 'pt-BR')),
      distances: Array.from(
        new Set(
          this.items
            .map((item) => item.customDistance?.trim() || item.distance)
            .filter(Boolean),
        ),
      ).sort((left, right) => left.localeCompare(right, 'pt-BR', { numeric: true })),
      categories: Array.from(
        new Set(this.items.map((item) => item.category).filter(Boolean)),
      ).sort((left, right) => left.localeCompare(right, 'pt-BR')),
      competitions: Array.from(
        new Set(this.items.map((item) => item.competition).filter(Boolean)),
      ).sort((left, right) => left.localeCompare(right, 'pt-BR')),
      eventFormats: Array.from(
        new Set(this.items.map((item) => item.eventFormat).filter(Boolean)),
      ).sort((left, right) => left.localeCompare(right, 'pt-BR')),
    };
  }

  async listCompetitionContexts(
    params?: ListResultsRepositoryParams,
  ): Promise<ResultCompetitionContext[]> {
    const uniqueContexts = new Map<string, ResultCompetitionContext>();

    this.filterItems(params)
      .filter(
        (item) =>
          item.resultStatus === 'Classificado' &&
          Number.isFinite(item.timeInSeconds) &&
          item.timeInSeconds > 0,
      )
      .forEach((item) => {
        const context = buildResultCompetitionContext(item);
        if (!uniqueContexts.has(context.key)) {
          uniqueContexts.set(context.key, context);
        }
      });

    return Array.from(uniqueContexts.values()).sort((left, right) => {
      const labelComparison = left.label.localeCompare(right.label, 'pt-BR', {
        numeric: true,
      });

      if (labelComparison !== 0) return labelComparison;
      return left.subtitle.localeCompare(right.subtitle, 'pt-BR');
    });
  }

  async getStyleDistribution(
    params?: ListResultsRepositoryParams,
  ): Promise<ResultStyleDistributionItem[]> {
    const counts = new Map<string, number>();

    this.filterItems(params).forEach((item) => {
      counts.set(item.style, (counts.get(item.style) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([style, count]) => ({
        style,
        label: style,
        count,
      }))
      .sort((left, right) => left.style.localeCompare(right.style, 'pt-BR'));
  }

  async getEvolution(params?: ResultEvolutionParams): Promise<ResultEvolution> {
    const chartStartDate = params?.chartStartDate?.trim();
    const chartEndDate = params?.chartEndDate?.trim();
    const filtered = this.filterItems(params)
      .filter((item) => item.resultStatus === 'Classificado')
      .filter((item) => item.timeInSeconds > 0)
      .filter((item) => !chartStartDate || item.date >= chartStartDate)
      .filter((item) => !chartEndDate || item.date <= chartEndDate);

    const studentsMap = new Map<
      string,
      { studentId: string; studentName: string; resultCount: number }
    >();

    filtered.forEach((item) => {
      const existing = studentsMap.get(item.studentId);
      if (existing) {
        existing.resultCount += 1;
        return;
      }

      studentsMap.set(item.studentId, {
        studentId: item.studentId,
        studentName: item.studentName,
        resultCount: 1,
      });
    });

    const focused = params?.focusStudentId
      ? filtered.filter((item) => item.studentId === params.focusStudentId)
      : filtered;

    const grouped = new Map<
      string,
      Map<string, { studentId: string; studentName: string; bestTimeSeconds: number }>
    >();

    focused.forEach((item) => {
      const monthKey = item.date.slice(0, 7);
      const monthGroup = grouped.get(monthKey) ?? new Map();
      const existing = monthGroup.get(item.studentId);

      if (!existing || item.timeInSeconds < existing.bestTimeSeconds) {
        monthGroup.set(item.studentId, {
          studentId: item.studentId,
          studentName: item.studentName,
          bestTimeSeconds: item.timeInSeconds,
        });
      }

      grouped.set(monthKey, monthGroup);
    });

    return {
      students: Array.from(studentsMap.values()).sort((left, right) =>
        left.studentName.localeCompare(right.studentName, 'pt-BR'),
      ),
      points: Array.from(grouped.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([monthKey, values]) => ({
          monthKey,
          monthLabel: formatMonthLabel(monthKey),
          values: Array.from(values.values()).sort((left, right) =>
            left.studentName.localeCompare(right.studentName, 'pt-BR'),
          ),
        })),
    };
  }

  async listRankingCandidates(input: GenerateRankingRequest): Promise<Result[]> {
    const normalizedCourseType = normalizeCourseType(input.courseType);
    const customDistance = input.customDistance?.trim() || undefined;

    return this.items
      .filter((item) => item.resultStatus === 'Classificado')
      .filter((item) => item.discipline === input.discipline)
      .filter((item) => item.competitionType === input.competitionType)
      .filter(
        (item) => (normalizeCourseType(item.courseType) ?? undefined) === normalizedCourseType,
      )
      .filter((item) => item.style === input.style)
      .filter((item) => item.distance === input.distance)
      .filter((item) => (item.customDistance?.trim() || undefined) === customDistance)
      .filter((item) => item.eventFormat === input.eventFormat)
      .filter((item) => item.category === input.category);
  }

  async listRecordCandidates(
    params?: ListResultsRepositoryParams,
  ): Promise<Result[]> {
    return this.filterItems(params);
  }

  async create(input: CreateResultRepositoryInput): Promise<Result> {
    const duration = normalizeResultTime(input.time);

    const result = makeResult({
      studentId: input.studentId,
      discipline: input.discipline ?? 'Piscina',
      competitionType: input.competitionType ?? input.discipline ?? 'Piscina',
      courseType: normalizeCourseType(input.courseType),
      style: input.style,
      distance: input.distance,
      customDistance: input.customDistance || undefined,
      eventFormat: input.eventFormat ?? 'Prova Individual',
      time: duration.time,
      timeInSeconds: duration.timeInSeconds,
      date: input.date,
      competition: input.competition ?? '',
      position: input.position ?? 0,
      resultStatus: input.resultStatus ?? 'Classificado',
      category: input.category ?? '',
      notes: input.notes ?? '',
    });

    this.items.push(result);
    return result;
  }

  async update(
    id: string,
    input: UpdateResultRepositoryInput,
  ): Promise<Result> {
    const itemIndex = this.items.findIndex((item) => item.id === id);

    if (itemIndex < 0) {
      throw new AppError(404, 'Result not found');
    }

    const duration = normalizeResultTime(input.time);

    const updatedResult: Result = {
      ...this.items[itemIndex],
      studentId: input.studentId,
      discipline: input.discipline,
      competitionType: input.competitionType,
      courseType: normalizeCourseType(input.courseType),
      style: input.style,
      distance: input.distance,
      customDistance: input.customDistance || undefined,
      eventFormat: input.eventFormat,
      time: duration.time,
      timeInSeconds: duration.timeInSeconds,
      date: input.date,
      competition: input.competition ?? '',
      position: input.position ?? 0,
      resultStatus: input.resultStatus,
      personalBest: input.personalBest,
      improvement: input.improvement,
      category: input.category ?? '',
      notes: input.notes ?? '',
    };

    this.items[itemIndex] = updatedResult;
    return updatedResult;
  }

  async remove(id: string): Promise<Result> {
    const itemIndex = this.items.findIndex((item) => item.id === id);

    if (itemIndex < 0) {
      throw new AppError(404, 'Result not found');
    }

    const [removedResult] = this.items.splice(itemIndex, 1);
    return removedResult;
  }
}

