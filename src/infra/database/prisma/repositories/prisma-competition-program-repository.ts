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

  private async assertSportingEvent(
    eventId: string,
    discipline?: 'pool' | 'open-water',
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    const event = await client.event.findUnique({
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
    if (discipline === 'pool') {
      const [oppositeRaces, oppositeResults] = await Promise.all([
        client.openWaterProgramRace.count({ where: { eventId } }),
        client.openWaterResult.count({ where: { eventId } }),
      ]);
      if (oppositeRaces || oppositeResults) {
        throw new AppError(409, 'Event already contains open-water records');
      }
    }
    if (discipline === 'open-water') {
      const [oppositeRaces, oppositeResults] = await Promise.all([
        client.poolProgramRace.count({ where: { eventId } }),
        client.poolResult.count({ where: { eventId } }),
      ]);
      if (oppositeRaces || oppositeResults) {
        throw new AppError(409, 'Event already contains pool records');
      }
    }
  }

  private async lockEvent(tx: Prisma.TransactionClient, eventId: string): Promise<void> {
    // Serialize competing pool and open-water race creation for one event.
    await tx.$queryRaw(Prisma.sql`SELECT id FROM public.events WHERE id = ${eventId}::uuid FOR UPDATE`);
  }

  async createPoolRace(input: CreatePoolProgramRaceDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.lockEvent(tx, input.eventId);
        await this.assertSportingEvent(input.eventId, 'pool', tx);
        const race = await tx.poolProgramRace.create({
          data: { ...input, poolLengthMeters: new Prisma.Decimal(input.poolLengthMeters) },
        });
        return toPoolRecord(race);
      });
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
    try {
      return await this.prisma.$transaction(async (tx) => {
        const race = await tx.poolProgramRace.findUnique({
          where: { id: input.raceId },
          select: { eventId: true },
        });
        if (!race) throw new AppError(404, 'Pool race not found');
        await this.lockEvent(tx, race.eventId);
        await this.assertSportingEvent(race.eventId, 'pool', tx);
        return tx.poolProgramHeat.create({
          data: {
            raceId: input.raceId,
            heatNumber: input.heatNumber,
            plannedStartAt:
              input.plannedStartAt === undefined || input.plannedStartAt === null
                ? null
                : new Date(input.plannedStartAt),
          },
        });
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
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.lockEvent(tx, input.eventId);
        await this.assertSportingEvent(input.eventId, 'open-water', tx);
        return tx.openWaterProgramRace.create({ data: input });
      });
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
    try {
      return await this.prisma.$transaction(async (tx) => {
        const race = await tx.openWaterProgramRace.findUnique({
          where: { id: input.raceId },
          select: { eventId: true },
        });
        if (!race) throw new AppError(404, 'Open-water race not found');
        await this.lockEvent(tx, race.eventId);
        await this.assertSportingEvent(race.eventId, 'open-water', tx);
        return tx.openWaterProgramStart.create({
          data: {
            raceId: input.raceId,
            waveNumber: input.waveNumber,
            plannedStartAt:
              input.plannedStartAt === undefined || input.plannedStartAt === null
                ? null
                : new Date(input.plannedStartAt),
          },
        });
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
