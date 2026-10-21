import type { Prisma } from '@prisma/client';
import type { Result } from '@/domain/results/enterprise/entities/result';
import { formatDurationFromMilliseconds } from '@/shared/utils/duration';

export const resultStudentInclude = {
  student: { select: { name: true } },
} as const;

export type PoolRecord = Prisma.PoolResultGetPayload<{
  include: typeof resultStudentInclude;
}>;
export type OpenWaterRecord = Prisma.OpenWaterResultGetPayload<{
  include: typeof resultStudentInclude;
}>;

const waterToLabel = {
  SEA: 'Mar',
  RIVER: 'Rio',
  LAKE: 'Lago',
  RESERVOIR: 'Represa',
} as const;

const formatToLabel = {
  INDIVIDUAL: 'Prova Individual',
  RELAY: 'Revezamento',
  TRAVESSIA: 'Travessia',
  KNOCKOUT_SPRINT: 'Knockout Sprint',
  ULTRAMARATHON: 'Ultramaratona',
} as const;

const statusToLabel = {
  PENDING: 'Pendente',
  CLASSIFIED: 'Classificado',
  DISQUALIFIED: 'Desclassificado',
  DID_NOT_START: 'Não largou',
  DID_NOT_FINISH: 'Não completou',
} as const;

const resultTime = (ms: number | null) =>
  ms === null ? '' : formatDurationFromMilliseconds(ms, 2);

const poolCourse = (meters: number | null): Result['courseType'] => {
  if (meters === 25) return 'Piscina Curta';
  if (meters === 50) return 'Piscina Longa';
  return undefined;
};

export class PrismaCompetitiveResultMapper {
  static pool(this: void, row: PoolRecord): Result {
    const poolLengthMeters =
      row.poolLengthMeters === null ? null : Number(row.poolLengthMeters);

    return {
      id: row.id,
      studentId: row.studentId,
      studentName: row.student.name,
      discipline: 'Piscina',
      competitionType: 'Piscina',
      style: row.style,
      distance: `${row.distanceMeters}m`,
      courseType: poolCourse(poolLengthMeters),
      poolLengthMeters,
      eventFormat: formatToLabel[row.format],
      durationMs: row.durationMs,
      time: resultTime(row.durationMs),
      timeInSeconds: row.durationMs === null ? 0 : row.durationMs / 1000,
      date: row.heldOn.toISOString().slice(0, 10),
      competition: row.competitionSnapshot ?? '',
      position: row.position ?? 0,
      resultStatus: statusToLabel[row.status],
      personalBest: false,
      improvement: 0,
      category: row.categorySnapshot ?? '',
      notes: row.notes ?? undefined,
    };
  }

  static openWater(this: void, row: OpenWaterRecord): Result {
    return {
      id: row.id,
      studentId: row.studentId,
      studentName: row.student.name,
      discipline: 'Aguas Abertas',
      competitionType: 'Aguas Abertas',
      // Explicit legacy display label; the DB still stores NULL when unspecified.
      style: row.style ?? 'Nao informado',
      distance: `${row.distanceMeters}m`,
      courseType: row.bodyType ? waterToLabel[row.bodyType] : undefined,
      routeKey: row.routeKey,
      eventFormat: formatToLabel[row.format],
      durationMs: row.durationMs,
      time: resultTime(row.durationMs),
      timeInSeconds: row.durationMs === null ? 0 : row.durationMs / 1000,
      date: row.heldOn.toISOString().slice(0, 10),
      competition: row.competitionSnapshot ?? '',
      position: row.position ?? 0,
      resultStatus: statusToLabel[row.status],
      personalBest: false,
      improvement: 0,
      category: row.categorySnapshot ?? '',
      notes: row.notes ?? undefined,
    };
  }
}
