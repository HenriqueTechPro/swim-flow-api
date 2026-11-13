import { NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@/infra/auth/auth.types';
import { PrismaService } from '@/infra/database/prisma/prisma.service';
import { StudentProgressReportService } from './student-progress-report.service';

const studentId = '11111111-1111-4111-8111-111111111111';
const period = { from: '2026-01-01', to: '2026-12-31' };

function setup(studentExists: boolean) {
  const prisma = {
    student: {
      findFirst: jest.fn(async () =>
        studentExists
          ? {
              id: studentId,
              name: 'Aluno Exemplo',
              birthDate: new Date('2015-01-10'),
              status: 'Ativo',
            }
          : null,
      ),
    },
    attendanceRecord: {
      groupBy: jest.fn(async () => [
        { status: 'present', _count: { _all: 2 } },
        { status: 'justified', _count: { _all: 1 } },
      ]),
    },
    anthropometricAssessment: {
      count: jest.fn(async () => 0),
      findFirst: jest.fn(async () => null),
    },
    poolResult: { groupBy: jest.fn(async () => []) },
    openWaterResult: { count: jest.fn(async () => 0) },
  };
  return {
    prisma,
    service: new StudentProgressReportService(
      prisma as unknown as PrismaService,
    ),
  };
}

describe('StudentProgressReportService', () => {
  const teacher: AuthUser = {
    id: '22222222-2222-4222-8222-222222222222',
    email: null,
    sessionId: 'session-1',
    role: 'teacher',
  };

  it('fails closed for a teacher without a verified active class link', async () => {
    const { service, prisma } = setup(false);
    await expect(service.get(studentId, period, teacher)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.student.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          studentClasses: {
            some: {
              toDate: null,
              swimmingClass: {
                classTeachers: {
                  some: {
                    teacher: {
                      profileId: teacher.id,
                      status: 'Ativo',
                    },
                  },
                },
              },
            },
          },
        }),
      }),
    );
    expect(prisma.attendanceRecord.groupBy).not.toHaveBeenCalled();
  });

  it('only counts recorded attendance and returns missing data explicitly', async () => {
    const { service, prisma } = setup(true);
    const report = await service.get(studentId, period, teacher);
    expect(report.attendance.recordedSessions).toBe(3);
    expect(report.attendance.presencePercentage).toBe(66.7);
    expect(report.physical.changes).toEqual({});
    expect(report.physical.initial).toBeNull();
    expect(report.sports.poolBestTimes).toEqual([]);
    expect(prisma.attendanceRecord.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          studentId,
          date: {
            gte: new Date('2026-01-01T00:00:00.000Z'),
            lte: new Date('2026-12-31T00:00:00.000Z'),
          },
        },
      }),
    );
  });

  it('never allows an unsupported user role to access a report', async () => {
    const { service, prisma } = setup(true);
    await expect(
      service.get(studentId, period, { ...teacher, role: 'user' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.student.findFirst).not.toHaveBeenCalled();
  });
});
