import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@/infra/auth/auth.types';
import { PrismaService } from '@/infra/database/prisma/prisma.service';
import {
  summarizePhysicalProgress,
  summarizeStudentAttendance,
  type AttendanceStatus,
} from '@/domain/students/application/services/student-progress-report.policy';
import type { StudentProgressReportQuery } from '@/shared/contracts/student-progress-report';

const physicalSelection = {
  measuredOn: true,
  heightCm: true,
  bodyMassKg: true,
  armSpanCm: true,
  legLengthCm: true,
  footLengthCm: true,
  handLengthCm: true,
  trunkLengthCm: true,
} as const;

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

@Injectable()
export class StudentProgressReportService {
  constructor(private readonly prisma: PrismaService) {}

  async get(
    studentId: string,
    query: StudentProgressReportQuery,
    user: AuthUser,
  ) {
    if (user.role !== 'admin' && user.role !== 'teacher') {
      throw new NotFoundException('Aluno não encontrado');
    }

    let from: string;
    let to: string;
    let season: { id: string; label: string } | null = null;

    if (query.seasonId) {
      const selectedSeason = await this.prisma.season.findUnique({
        where: { id: query.seasonId },
        select: {
          id: true,
          label: true,
          startsOn: true,
          endsOn: true,
        },
      });
      if (!selectedSeason) {
        throw new NotFoundException('Temporada não encontrada');
      }
      from = isoDate(selectedSeason.startsOn);
      to = isoDate(selectedSeason.endsOn);
      season = { id: selectedSeason.id, label: selectedSeason.label };
    } else {
      // The Zod contract requires both dates when seasonId is absent.
      from = query.from!;
      to = query.to!;
    }

    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        ...(user.role === 'teacher'
          ? {
              studentClasses: {
                some: {
                  toDate: null,
                  swimmingClass: {
                    classTeachers: {
                      some: {
                        teacher: {
                          profileId: user.id,
                          status: 'Ativo' as const,
                        },
                      },
                    },
                  },
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        birthDate: true,
        status: true,
      },
    });
    if (!student) {
      // Do not disclose whether a student exists outside the teacher's scope.
      throw new NotFoundException('Aluno não encontrado');
    }

    const window = {
      gte: new Date(from + 'T00:00:00.000Z'),
      lte: new Date(to + 'T00:00:00.000Z'),
    };
    const physicalWhere = { studentId, measuredOn: window };

    const [
      attendanceGroups,
      assessmentCount,
      initialAssessment,
      finalAssessment,
      poolResults,
      openWaterResultsCount,
    ] = await Promise.all([
      this.prisma.attendanceRecord.groupBy({
        by: ['status'],
        where: { studentId, date: window },
        _count: { _all: true },
      }),
      this.prisma.anthropometricAssessment.count({
        where: physicalWhere,
      }),
      this.prisma.anthropometricAssessment.findFirst({
        where: physicalWhere,
        orderBy: [{ measuredOn: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        select: physicalSelection,
      }),
      this.prisma.anthropometricAssessment.findFirst({
        where: physicalWhere,
        orderBy: [
          { measuredOn: 'desc' },
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
        select: physicalSelection,
      }),
      this.prisma.poolResult.groupBy({
        by: ['style', 'distanceMeters', 'poolLengthMeters'],
        where: {
          studentId,
          heldOn: window,
          format: 'INDIVIDUAL',
          status: 'CLASSIFIED',
          durationMs: { not: null },
        },
        _count: { _all: true },
        _min: { durationMs: true },
        orderBy: [{ distanceMeters: 'asc' }, { style: 'asc' }],
      }),
      this.prisma.openWaterResult.count({
        where: { studentId, heldOn: window, status: 'CLASSIFIED' },
      }),
    ]);

    const asMeasurement = (row: typeof initialAssessment) =>
      row
        ? {
            measuredOn: isoDate(row.measuredOn),
            values: {
              heightCm: row.heightCm?.toNumber() ?? null,
              bodyMassKg: row.bodyMassKg?.toNumber() ?? null,
              armSpanCm: row.armSpanCm?.toNumber() ?? null,
              legLengthCm: row.legLengthCm?.toNumber() ?? null,
              footLengthCm: row.footLengthCm?.toNumber() ?? null,
              handLengthCm: row.handLengthCm?.toNumber() ?? null,
              trunkLengthCm: row.trunkLengthCm?.toNumber() ?? null,
            },
          }
        : null;

    return {
      student: {
        id: student.id,
        name: student.name,
        birthDate: student.birthDate ? isoDate(student.birthDate) : null,
        status: student.status,
      },
      period: { from, to, season },
      attendance: summarizeStudentAttendance(
        attendanceGroups.map((item) => ({
          status: item.status as AttendanceStatus,
          count: item._count._all,
        })),
      ),
      physical: summarizePhysicalProgress(
        assessmentCount,
        asMeasurement(initialAssessment),
        asMeasurement(finalAssessment),
      ),
      sports: {
        // Only compare equivalent individual pool events; 25m and 50m are
        // separate groups, as are styles and distances.
        poolBestTimes: poolResults
          .filter((item) => item._min.durationMs !== null)
          .map((item) => ({
            style: item.style,
            distanceMeters: item.distanceMeters,
            poolLengthMeters: item.poolLengthMeters?.toNumber() ?? null,
            bestDurationMs: item._min.durationMs!,
            resultCount: item._count._all,
          })),
        openWaterClassifiedResults: openWaterResultsCount,
      },
    };
  }
}
