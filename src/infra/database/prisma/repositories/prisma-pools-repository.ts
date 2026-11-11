import { Injectable } from '@nestjs/common';
import type { PoolStatus as PrismaPoolStatus } from '@prisma/client';
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
import {
  PoolsRepository,
  type CreatePoolRepositoryInput,
  type ListPoolsRepositoryParams,
  type UpdatePoolRepositoryInput,
} from '@/domain/pools/application/repositories/pools-repository';
import { AppError } from '@/shared/errors/app-error';
import { PrismaService } from '../prisma.service';
import { calculatePoolOccupancy } from '@/domain/pools/application/services/calculate-pool-occupancy';
import { weekdayValues, normalizeWeekday } from '@/shared/contracts/weekdays';
import {
  PrismaPoolMapper,
  type PrismaPoolRecord,
} from '../mappers/prisma-pool-mapper';

const toPrismaPoolStatus = (status?: string): PrismaPoolStatus | undefined => {
  if (!status) return undefined;
  if (status === 'Manutenção') {
    return 'Manutencao';
  }
  if (status === 'Ativa' || status === 'Inativa') {
    return status;
  }
  return undefined;
};

@Injectable()
export class PrismaPoolsRepository implements PoolsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheRepository,
    private readonly env: EnvService,
  ) {}

  async occupancyPreview(id: string, date: string) {
    const day = new Date(`${date}T12:00:00.000Z`);
    const weekday = weekdayValues[(day.getUTCDay() + 6) % 7];
    const dateValue = new Date(`${date}T00:00:00.000Z`);
    const pool = await this.prisma.pool.findUnique({
      where: { id },
      select: { id: true, name: true, maxCapacity: true },
    });
    if (!pool) throw new AppError(404, 'Pool not found');

    const [classes, trainings] = await Promise.all([
      this.prisma.swimmingClass.findMany({
        where: { poolId: id, status: 'Ativa' },
        select: {
          id: true,
          name: true,
          classSchedules: {
            select: { dayOfWeek: true, startTime: true, endTime: true },
          },
          studentClasses: {
            where: {
              fromDate: { lte: dateValue },
              OR: [{ toDate: null }, { toDate: { gte: dateValue } }],
            },
            select: { studentId: true },
          },
        },
      }),
      this.prisma.training.findMany({
        where: { poolId: id, venueType: 'Piscina', status: 'Ativo' },
        select: {
          id: true,
          title: true,
          dayOfWeek: true,
          startTime: true,
          endTime: true,
          currentParticipants: true,
        },
      }),
    ]);
    const mapped = classes.map((item) => ({
      id: item.id,
      name: item.name,
      studentIds: item.studentClasses.map((enrollment) => enrollment.studentId),
      schedules: item.classSchedules
        .filter((schedule) => normalizeWeekday(schedule.dayOfWeek) === weekday)
        .map((schedule) => ({
          startTime: schedule.startTime.toISOString().slice(11, 16),
          endTime: schedule.endTime.toISOString().slice(11, 16),
        })),
    }));
    const trainingItems = trainings
      .filter((item) => normalizeWeekday(item.dayOfWeek) === weekday)
      .map((item) => ({
        id: item.id,
        title: item.title,
        startTime: item.startTime.toISOString().slice(11, 16),
        endTime: item.endTime.toISOString().slice(11, 16),
        declaredParticipants: item.currentParticipants,
      }));
    return calculatePoolOccupancy(
      { id: pool.id, name: pool.name, capacity: pool.maxCapacity },
      date,
      weekday,
      mapped,
      trainingItems,
    );
  }

  async list(params?: ListPoolsRepositoryParams) {
    const { page, perPage } = normalizePaginationParams(params);
    const search = params?.search?.trim();
    const status = toPrismaPoolStatus(params?.status?.trim());
    const cacheKey = `${buildPaginatedCacheKey('pools', page, perPage)}:${search ?? ''}:${status ?? ''}`;

    return rememberPaginatedResult(
      this.cache,
      cacheKey,
      this.env.cacheTtlSeconds,
      async () => {
        const skip = (page - 1) * perPage;
        const where = {
          ...(status ? { status } : {}),
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: 'insensitive' as const } },
                  {
                    address: { contains: search, mode: 'insensitive' as const },
                  },
                ],
              }
            : {}),
        };

        const [pools, total] = await this.prisma.$transaction([
          this.prisma.pool.findMany({
            where,
            orderBy: { name: 'asc' },
            skip,
            take: perPage,
          }),
          this.prisma.pool.count({ where }),
        ]);

        return createPaginatedResult(
          (pools as unknown as PrismaPoolRecord[]).map(
            PrismaPoolMapper.toDomain,
          ),
          total,
          { page, perPage },
        );
      },
    );
  }

  async create(input: CreatePoolRepositoryInput) {
    const pool = await this.prisma.pool.create({
      data: {
        name: input.name,
        lengthMeters: input.lengthMeters,
        address: input.address,
        status: toPrismaPoolStatus(input.status) ?? 'Ativa',
        maxCapacity: input.maxCapacity ?? null,
      },
    });

    await this.cache.deleteMatching('pools:list:');
    return PrismaPoolMapper.toDomain(pool as unknown as PrismaPoolRecord);
  }

  async update(id: string, input: UpdatePoolRepositoryInput) {
    const existing = await this.prisma.pool.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError(404, 'Pool not found');
    }

    const pool = await this.prisma.pool.update({
      where: { id },
      data: {
        name: input.name,
        lengthMeters: input.lengthMeters,
        address: input.address,
        status: toPrismaPoolStatus(input.status) ?? 'Ativa',
        maxCapacity: input.maxCapacity ?? null,
      },
    });

    await this.cache.deleteMatching('pools:list:');
    return PrismaPoolMapper.toDomain(pool as unknown as PrismaPoolRecord);
  }

  async remove(id: string) {
    const existing = await this.prisma.pool.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError(404, 'Pool not found');
    }

    await this.prisma.pool.delete({
      where: { id },
    });

    await this.cache.deleteMatching('pools:list:');
    return PrismaPoolMapper.toDomain(existing as unknown as PrismaPoolRecord);
  }
}
