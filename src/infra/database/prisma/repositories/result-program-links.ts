import { AppError } from '@/shared/errors/app-error';
import type { CreateResultRequest } from '@/domain/results/application/dtos/result-requests';
import { PrismaService } from '../prisma.service';

export type ProgramLinks = Pick<
  CreateResultRequest,
  | 'poolProgramRaceId'
  | 'poolProgramHeatId'
  | 'openWaterProgramRaceId'
  | 'openWaterProgramStartId'
>;

const poolFormats: Record<string, string> = {
  'Prova Individual': 'INDIVIDUAL',
  Revezamento: 'RELAY',
};
const waterFormats: Record<string, string> = {
  'Prova Individual': 'INDIVIDUAL',
  Revezamento: 'RELAY',
  Travessia: 'TRAVESSIA',
  'Knockout Sprint': 'KNOCKOUT_SPRINT',
  Ultramaratona: 'ULTRAMARATHON',
};
const waterTypes: Record<string, string> = {
  Mar: 'SEA', Rio: 'RIVER', Lago: 'LAKE', Represa: 'RESERVOIR',
};

function distanceMeters(input: CreateResultRequest): number {
  const match = /^(\d+(?:[.,]\d+)?)(m|km)$/i.exec(
    (input.customDistance?.trim() || input.distance).trim(),
  );
  if (!match) throw new AppError(422, 'Invalid race distance');
  const meters = Number(match[1].replace(',', '.')) * (match[2].toLowerCase() === 'km' ? 1000 : 1);
  if (!Number.isSafeInteger(meters) || meters <= 0) throw new AppError(422, 'Invalid race distance');
  return meters;
}

function poolLength(input: CreateResultRequest): number | null {
  if (input.poolLengthMeters !== undefined) return input.poolLengthMeters;
  if (input.courseType === 'Piscina Curta') return 25;
  if (input.courseType === 'Piscina Longa') return 50;
  return null;
}

/**
 * This validates explicit IDs only. Never infer race/heat from a competition
 * name, event date or student's present-day category/gender.
 *
 * FK restrictions protect races/series against deletion after linking. All
 * optional IDs are null for historical results until manually selected.
 */
export async function validateProgramLinks(
  prisma: PrismaService,
  input: CreateResultRequest,
  eventId: string | null | undefined,
  links: ProgramLinks,
): Promise<void> {
  const { poolProgramRaceId, poolProgramHeatId, openWaterProgramRaceId, openWaterProgramStartId } = links;

  if (input.discipline === 'Piscina') {
    if (openWaterProgramRaceId || openWaterProgramStartId) {
      throw new AppError(422, 'Pool results cannot use open-water links');
    }
    if (poolProgramHeatId && !poolProgramRaceId) {
      throw new AppError(422, 'A pool heat requires the matching pool race');
    }
    if (eventId && await prisma.openWaterProgramRace.count({ where: { eventId } })) {
      throw new AppError(409, 'Event already has open-water programming');
    }
    if (!poolProgramRaceId) return;
    if (!eventId) throw new AppError(422, 'Select an event before linking a pool race');
    const race = await prisma.poolProgramRace.findUnique({ where: { id: poolProgramRaceId } });
    if (!race || race.eventId !== eventId) {
      throw new AppError(422, 'Selected pool race belongs to another event');
    }
    if (
      race.style !== input.style ||
      race.distanceMeters !== distanceMeters(input) ||
      Number(race.poolLengthMeters) !== poolLength(input) ||
      race.format !== poolFormats[input.eventFormat] ||
      race.categorySnapshot !== input.category?.trim()
    ) {
      throw new AppError(422, 'Pool result does not match selected race');
    }
    if (poolProgramHeatId) {
      const heat = await prisma.poolProgramHeat.findUnique({
        where: { id: poolProgramHeatId }, select: { raceId: true },
      });
      if (!heat || heat.raceId !== race.id) {
        throw new AppError(422, 'Selected pool heat belongs to another race');
      }
    }
    return;
  }

  if (poolProgramRaceId || poolProgramHeatId) {
    throw new AppError(422, 'Open-water results cannot use pool links');
  }
  if (openWaterProgramStartId && !openWaterProgramRaceId) {
    throw new AppError(422, 'An open-water start requires the matching race');
  }
  if (eventId && await prisma.poolProgramRace.count({ where: { eventId } })) {
    throw new AppError(409, 'Event already has pool programming');
  }
  if (!openWaterProgramRaceId) return;
  if (!eventId) throw new AppError(422, 'Select an event before linking an open-water race');
  const race = await prisma.openWaterProgramRace.findUnique({ where: { id: openWaterProgramRaceId } });
  if (!race || race.eventId !== eventId) {
    throw new AppError(422, 'Selected open-water race belongs to another event');
  }
  if (
    race.distanceMeters !== distanceMeters(input) ||
    race.bodyType !== waterTypes[input.courseType ?? ''] ||
    race.routeKey !== input.routeKey?.trim() ||
    race.format !== waterFormats[input.eventFormat] ||
    race.categorySnapshot !== input.category?.trim()
  ) {
    throw new AppError(422, 'Open-water result does not match selected race and route');
  }
  if (openWaterProgramStartId) {
    const start = await prisma.openWaterProgramStart.findUnique({
      where: { id: openWaterProgramStartId }, select: { raceId: true },
    });
    if (!start || start.raceId !== race.id) {
      throw new AppError(422, 'Selected open-water start belongs to another race');
    }
  }
}
