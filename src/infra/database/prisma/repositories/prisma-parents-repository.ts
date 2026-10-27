import type { Prisma } from '@prisma/client';
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
import {
  ParentsRepository,
  type CreateParentRepositoryInput,
  type ListParentsRepositoryParams,
  type UpdateParentRepositoryInput,
} from '@/domain/parents/application/repositories/parents-repository';
import { AppError } from '@/shared/errors/app-error';
import { PrismaService } from '../prisma.service';
import {
  PrismaParentMapper,
  type PrismaParentRecord,
} from '../mappers/prisma-parent-mapper';

const parentInclude = {
  studentGuardians: {
    include: { student: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
};

@Injectable()
export class PrismaParentsRepository implements ParentsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheRepository,
    private readonly env: EnvService,
  ) {}

  async findById(id: string) {
    const parent = await this.prisma.parent.findUnique({
      where: { id },
      include: parentInclude,
    });
    if (!parent) return null;
    return PrismaParentMapper.toDomain(
      parent as unknown as PrismaParentRecord,
    );
  }

  async list(params?: ListParentsRepositoryParams) {
    const { page, perPage } = normalizePaginationParams(params);
    const search = params?.search?.trim();
    const status = params?.status?.trim();
    const cacheKey = `${buildPaginatedCacheKey('parents', page, perPage)}:${search ?? ''}:${status ?? ''}`;

    return rememberPaginatedResult(
      this.cache,
      cacheKey,
      this.env.cacheTtlSeconds,
      async () => {
        const skip = (page - 1) * perPage;
        const where: Prisma.ParentWhereInput = {
          ...(status ? { status: status as never } : {}),
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { email: { contains: search, mode: 'insensitive' } },
                  { profession: { contains: search, mode: 'insensitive' } },
                  {
                    studentGuardians: {
                      some: { student: {
                        name: { contains: search, mode: 'insensitive' },
                      } },
                    },
                  },
                ],
              }
            : {}),
        };

        const [parents, total] = await this.prisma.$transaction([
          this.prisma.parent.findMany({
            where,
            include: parentInclude,
            orderBy: { name: 'asc' },
            skip,
            take: perPage,
          }),
          this.prisma.parent.count({ where }),
        ]);

        return createPaginatedResult(
          (parents as unknown as PrismaParentRecord[]).map(
            PrismaParentMapper.toDomain,
          ),
          total,
          { page, perPage },
        );
      },
    );
  }

  async create(input: CreateParentRepositoryInput) {
    const parent = await this.prisma.$transaction(async (tx) => {
      const created = await tx.parent.create({
        data: {
          name: input.name,
          photo: input.photo || null,
          cpf: input.cpf || null,
          birthDate: input.birthDate ? new Date(input.birthDate) : null,
          phone: input.phone,
          email: input.email,
          profession: input.profession,
          address: input.address,
          emergencyContact: input.emergencyContact,
          emergencyPhone: input.emergencyPhone,
          status: input.status as never,
        },
      });

      await this.syncChildren(tx, created.id, input.childrenIds);

      return tx.parent.findUniqueOrThrow({
        where: { id: created.id },
        include: parentInclude,
      });
    });

    await this.cache.deleteMatching('parents:list:');
    await this.cache.deleteMatching('students:list:');
    return PrismaParentMapper.toDomain(parent as unknown as PrismaParentRecord);
  }

  async update(id: string, input: UpdateParentRepositoryInput) {
    const existing = await this.prisma.parent.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError(404, 'Parent not found');
    }

    const parent = await this.prisma.$transaction(async (tx) => {
      await tx.parent.update({
        where: { id },
        data: {
          name: input.name,
          photo: input.photo || null,
          cpf: input.cpf || null,
          birthDate: input.birthDate ? new Date(input.birthDate) : null,
          phone: input.phone,
          email: input.email,
          profession: input.profession,
          address: input.address,
          emergencyContact: input.emergencyContact,
          emergencyPhone: input.emergencyPhone,
          status: input.status as never,
        },
      });

      await this.syncChildren(tx, id, input.childrenIds);

      return tx.parent.findUniqueOrThrow({
        where: { id },
        include: parentInclude,
      });
    });

    await this.cache.deleteMatching('parents:list:');
    await this.cache.deleteMatching('students:list:');
    return PrismaParentMapper.toDomain(parent as unknown as PrismaParentRecord);
  }

  async remove(id: string) {
    const existing = await this.prisma.parent.findUnique({
      where: { id },
      include: parentInclude,
    });

    if (!existing) {
      throw new AppError(404, 'Parent not found');
    }

    await this.prisma.$transaction(async (tx) => {
      // Relations to students are explicitly links; the FK cascade removes
      // only this guardian's links and preserves other adults.
      await tx.parent.delete({
        where: { id },
      });
    });

    await this.cache.deleteMatching('parents:list:');
    await this.cache.deleteMatching('students:list:');
    return PrismaParentMapper.toDomain(
      existing as unknown as PrismaParentRecord,
    );
  }

  private async syncChildren(
    tx: Prisma.TransactionClient,
    parentId: string,
    childrenIds: string[],
  ) {
    const requestedIds = [...new Set(childrenIds)];
    const existing = await tx.studentGuardian.findMany({
      where: { parentId },
      select: { studentId: true },
    });
    const existingIds = new Set(existing.map((item) => item.studentId));
    const idsToAdd = requestedIds.filter((id) => !existingIds.has(id));

    // A misspelled/unknown child id must roll back the entire transaction.
    // Never silently accept a partial relationship update.
    if (requestedIds.length > 0) {
      const found = await tx.student.findMany({
        where: { id: { in: requestedIds } },
        select: { id: true },
      });
      if (found.length !== requestedIds.length) {
        throw new AppError(422, 'One or more selected students do not exist');
      }
    }

    await tx.studentGuardian.deleteMany({
      where: {
        parentId,
        studentId: { notIn: requestedIds },
      },
    });

    if (idsToAdd.length === 0) return;

    // An existing principal adult is never silently replaced when an
    // additional guardian is linked through the parent's form.
    const primaryLinks = await tx.studentGuardian.findMany({
      where: { studentId: { in: idsToAdd }, isPrimary: true },
      select: { studentId: true },
    });
    const hasPrimary = new Set(primaryLinks.map((item) => item.studentId));

    await tx.studentGuardian.createMany({
      data: idsToAdd.map((studentId) => ({
        parentId,
        studentId,
        isPrimary: !hasPrimary.has(studentId),
        canReceiveUpdates: false,
      })),
      skipDuplicates: true,
    });
  }
}
