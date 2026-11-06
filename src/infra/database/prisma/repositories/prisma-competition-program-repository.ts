import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CompetitionProgramRepository,
  type PoolProgramRaceRecord,
} from '@/domain/competition-program/application/repositories/competition-program-repository';
import type {
  CreateOpenWaterProgramRaceDto,
  CreateOpenWaterProgramStartDto,
  CreatePoolProgramHeatDto,
  CreatePoolProgramRaceDto,
  ProgramRaceListDto,
  ProgramSeriesListDto,
} from '@/shared/contracts/competition-program';
import { AppError } from '@/shared/errors/app-error';
import { createPaginatedResult } from '@/domain/shared/pagination/pagination-utils';
import { PrismaService } from '../prisma.service';

const toPoolRecord = (value: {
  id: string;
  eventId: string;
  sessionCode: string;
  raceNumber: number;
  style: PoolProgramRaceRecord['style'];
  distanceMeters: number;
  poolLengthMeters: Prisma.Decimal;
  format: PoolProgramRaceRecord['format'];
  categorySnapshot: string;
  genderScope: PoolProgramRaceRecord['genderScope'];
  createdAt: Date;
  updatedAt: Date;
}): PoolProgramRaceRecord => ({
  ...value,
  poolLengthMeters: Number(value.poolLengthMeters),
});

function toConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new AppError(
        409,
        'Competition number or heat/start number is already registered',
      );
    }
    if (error.code === 'P2003') {
      throw new AppError(
        422,
        'The referenced event or race is no longer available',
      );
    }
  }
  throw error;
}

@Injectable()
export class PrismaCompetitionProgramRepository implements CompetitionProgramRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async assertSportingEvent(eventId: string): Promise<void> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { type: true, status: true },
    });
    if (!event) throw new AppError(404, 'Competition event not found');
    if (event.type !== 'Competicao' && event.type !== 'Festival') {
      throw new AppError(
        422,
        'Only competitions or festivals can have sporting races',
      );
    }
    if (event.status === 'Cancelado') {
      throw new AppError(409, 'Cancelled events cannot receive races');
    }
  }

  async createPoolRace(input: CreatePoolProgramRaceDto) {
    await this.assertSportingEvent(input.eventId);
    try {
      const race = await this.prisma.poolProgramRace.create({
        data: {
          ...input,
          poolLengthMeters: new Prisma.Decimal(input.poolLengthMeters),
        },
      });
      return toPoolRecord(race);
    } catch (error) {
      return toConflict(error);
    }
  }

  async listPoolRaces(input: ProgramRaceListDto) {
    const where = { eventId: input.eventId };
    const [rows, total] = await Promise.all([
      this.prisma.poolProgramRace.findMany({
        where,
        orderBy: [{ sessionCode: 'asc' }, { raceNumber: 'asc' }],
        skip: (input.page - 1) * input.perPage,
        take: input.perPage,
      }),
      this.prisma.poolProgramRace.count({ where }),
    ]);
    return createPaginatedResult(rows.map(toPoolRecord), total, input);
  }

  async createPoolHeat(input: CreatePoolProgramHeatDto) {
    const race = await this.prisma.poolProgramRace.findUnique({
      where: { id: input.raceId },
      select: { eventId: true },
    });
    if (!race) throw new AppError(404, 'Pool race not found');
    await this.assertSportingEvent(race.eventId);
    try {
      return await this.prisma.poolProgramHeat.create({
        data: {
          raceId: input.raceId,
          heatNumber: input.heatNumber,
          plannedStartAt:
            input.plannedStartAt === undefined || input.plannedStartAt === null
              ? null
              : new Date(input.plannedStartAt),
        },
      });
    } catch (error) {
      return toConflict(error);
    }
  }

  async listPoolHeats(input: ProgramSeriesListDto) {
    const where = { raceId: input.raceId };
    const [rows, total] = await Promise.all([
      this.prisma.poolProgramHeat.findMany({
        where,
        orderBy: [{ heatNumber: 'asc' }],
        skip: (input.page - 1) * input.perPage,
        take: input.perPage,
      }),
      this.prisma.poolProgramHeat.count({ where }),
    ]);
    return createPaginatedResult(rows, total, input);
  }

  async createOpenWaterRace(input: CreateOpenWaterProgramRaceDto) {
    await this.assertSportingEvent(input.eventId);
    try {
      return await this.prisma.openWaterProgramRace.create({ data: input });
    } catch (error) {
      return toConflict(error);
    }
  }

  async listOpenWaterRaces(input: ProgramRaceListDto) {
    const where = { eventId: input.eventId };
    const [rows, total] = await Promise.all([
      this.prisma.openWaterProgramRace.findMany({
        where,
        orderBy: [{ sessionCode: 'asc' }, { raceNumber: 'asc' }],
        skip: (input.page - 1) * input.perPage,
        take: input.perPage,
      }),
      this.prisma.openWaterProgramRace.count({ where }),
    ]);
    return createPaginatedResult(rows, total, input);
  }

  async createOpenWaterStart(input: CreateOpenWaterProgramStartDto) {
    const race = await this.prisma.openWaterProgramRace.findUnique({
      where: { id: input.raceId },
      select: { eventId: true },
    });
    if (!race) throw new AppError(404, 'Open-water race not found');
    await this.assertSportingEvent(race.eventId);
    try {
      return await this.prisma.openWaterProgramStart.create({
        data: {
          raceId: input.raceId,
          waveNumber: input.waveNumber,
          plannedStartAt:
            input.plannedStartAt === undefined || input.plannedStartAt === null
              ? null
              : new Date(input.plannedStartAt),
        },
      });
    } catch (error) {
      return toConflict(error);
    }
  }

  async listOpenWaterStarts(input: ProgramSeriesListDto) {
    const where = { raceId: input.raceId };
    const [rows, total] = await Promise.all([
      this.prisma.openWaterProgramStart.findMany({
        where,
        orderBy: [{ waveNumber: 'asc' }],
        skip: (input.page - 1) * input.perPage,
        take: input.perPage,
      }),
      this.prisma.openWaterProgramStart.count({ where }),
    ]);
    return createPaginatedResult(rows, total, input);
  }
}
