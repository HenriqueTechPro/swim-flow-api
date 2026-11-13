import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@/infra/auth/auth.types';
import { PrismaService } from '@/infra/database/prisma/prisma.service';
import { StudentProgressReportService } from './student-progress-report.service';

const studentId = '11111111-1111-4111-8111-111111111111';
const seasonId = '22222222-2222-4222-8222-222222222222';
const teacherId = '33333333-3333-4333-8333-333333333333';
const actorId = '44444444-4444-4444-8444-444444444444';

const actor: AuthUser = {
  id: actorId,
  email: 'teacher@example.invalid',
  sessionId: 'session',
  role: 'teacher',
};

function setup(studentFound = true) {
  const prisma = {
    student: {
      findFirst: jest.fn(async () => (studentFound ? { id: studentId } : null)),
    },
    season: { findUnique: jest.fn(async () => ({ id: seasonId })) },
    profile: { findUnique: jest.fn(async () => ({ fullName: 'Prof. Ana' })) },
    teacher: {
      findFirst: jest.fn(async () => ({
        id: teacherId,
        name: 'Ana',
        cref: '000001-G/BA',
      })),
      findUnique: jest.fn(async () => null),
    },
    studentProgressReportObservation: {
      upsert: jest.fn(async (_args: unknown) => ({
        seasonId,
        updatedAt: new Date('2026-11-13T12:00:00.000Z'),
      })),
    },
  };
  return {
    prisma,
    service: new StudentProgressReportService(
      prisma as unknown as PrismaService,
    ),
  };
}

describe('Student progress report observation', () => {
  it('rejects a teacher outside the current student scope', async () => {
    const { prisma, service } = setup(false);
    await expect(
      service.saveObservation(
        studentId,
        { seasonId, observation: 'Boa evolução' },
        actor,
      ),
    ).rejects.toThrow(NotFoundException);
    expect(
      prisma.studentProgressReportObservation.upsert,
    ).not.toHaveBeenCalled();
  });

  it('snapshots the teacher identity and author', async () => {
    const { prisma, service } = setup();
    await service.saveObservation(
      studentId,
      { seasonId, observation: 'Boa evolução' },
      actor,
    );
    expect(prisma.studentProgressReportObservation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          studentId_seasonId: { studentId, seasonId },
        },
        create: expect.objectContaining({
          observation: 'Boa evolução',
          responsibleTeacherId: teacherId,
          responsibleTeacherName: 'Ana',
          responsibleTeacherCref: '000001-G/BA',
          createdByProfileId: actorId,
          createdByName: 'Prof. Ana',
        }),
      }),
    );
  });

  it('never permits a teacher to sign under another professional', async () => {
    const { prisma, service } = setup();
    await expect(
      service.saveObservation(
        studentId,
        {
          seasonId,
          observation: 'Boa evolução',
          responsibleTeacherId: studentId,
        },
        actor,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(
      prisma.studentProgressReportObservation.upsert,
    ).not.toHaveBeenCalled();
  });

  it('avoids guessing an admin-selected coach', async () => {
    const { prisma, service } = setup();
    await service.saveObservation(
      studentId,
      { seasonId, observation: 'Relatório de fechamento' },
      { ...actor, role: 'admin' },
    );
    const arg =
      prisma.studentProgressReportObservation.upsert.mock.calls[0]?.[0];
    expect(arg?.create).not.toHaveProperty('responsibleTeacherId');
    expect(arg?.update).not.toHaveProperty('responsibleTeacherId');
  });
});
