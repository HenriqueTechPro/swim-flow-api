import { describe, expect, it, jest } from '@jest/globals';
import type { PrismaService } from '../prisma.service';
import type { CacheRepository } from '@/infra/cache/cache-repository';
import type { EnvService } from '@/infra/env/env.service';
import { PrismaParentsRepository } from './prisma-parents-repository';

describe('PrismaParentsRepository.findById', () => {
  it('reads one parent and includes linked students', async () => {
    const id = '83c31be4-abde-494e-8928-10889019b832';
    const childId = '7ee70455-7fb9-4a2f-8412-7f422d5ff4c9';
    const findUnique = jest.fn(async () => ({
      id,
      name: 'Responsavel de teste',
      cpf: null,
      birthDate: null,
      photo: null,
      phone: '',
      email: '',
      profession: '',
      address: '',
      emergencyContact: '',
      emergencyPhone: '',
      status: 'Ativo',
      studentGuardians: [{ student: { id: childId, name: 'Atleta' } }],
    }));
    const prisma = { parent: { findUnique } } as unknown as PrismaService;
    const repo = new PrismaParentsRepository(
      prisma,
      {} as CacheRepository,
      {} as EnvService,
    );

    const parent = await repo.findById(id);
    expect(parent?.childrenIds).toEqual([childId]);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id },
      include: {
        studentGuardians: {
          include: { student: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  });
});
