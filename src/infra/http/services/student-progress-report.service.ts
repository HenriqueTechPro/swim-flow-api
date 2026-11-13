import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '@/infra/auth/auth.types';
import { PrismaService } from '@/infra/database/prisma/prisma.service';
import {
  summarizePhysicalProgress,
  summarizeStudentAttendance,
  type AttendanceStatus,
} from '@/domain/students/application/services/student-progress-report.policy';
import type {
  SaveStudentProgressObservationDto,
  StudentProgressReportQuery,
} from '@/shared/contracts/student-progress-report';

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

    const observationRecord = query.seasonId
      ? await this.prisma.studentProgressReportObservation.findUnique({
          where: {
            studentId_seasonId: { studentId, seasonId: query.seasonId },
          },
        })
      : null;

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
      observation: observationRecord
        ? {
            text: observationRecord.observation,
            responsibleTeacherId: observationRecord.responsibleTeacherId,
            responsibleTeacherName: observationRecord.responsibleTeacherName,
            responsibleTeacherCref: observationRecord.responsibleTeacherCref,
            createdByName: observationRecord.createdByName,
            updatedByName: observationRecord.updatedByName,
            createdAt: observationRecord.createdAt,
            updatedAt: observationRecord.updatedAt,
          }
        : null,
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

  /**
   * Scoped mutation: teachers can write only for currently assigned pupils
   * and only under their own teacher identity. Historic authorship and CREF
   * are snapshotted at the time of saving, never inferred retrospectively.
   */
  async saveObservation(
    studentId: string,
    body: SaveStudentProgressObservationDto,
    user: AuthUser,
  ) {
    if (user.role !== 'admin' && user.role !== 'teacher') {
      throw new NotFoundException('Aluno não encontrado');
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
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Aluno não encontrado');

    const season = await this.prisma.season.findUnique({
      where: { id: body.seasonId },
      select: { id: true },
    });
    if (!season) throw new NotFoundException('Temporada não encontrada');

    const profile = await this.prisma.profile.findUnique({
      where: { id: user.id },
      select: { fullName: true },
    });
    if (!profile) throw new ForbiddenException('Perfil não encontrado');

    let responsibleTeacher:
      | { id: string; name: string; cref: string | null }
      | null
      | undefined;

    if (user.role === 'teacher') {
      const teacher = await this.prisma.teacher.findFirst({
        where: { profileId: user.id, status: 'Ativo' },
        select: { id: true, name: true, cref: true },
      });
      if (!teacher) throw new ForbiddenException('Professor não vinculado');
      if (
        body.responsibleTeacherId !== undefined &&
        body.responsibleTeacherId !== teacher.id
      ) {
        throw new ForbiddenException(
          'Professor só pode registrar o próprio nome',
        );
      }
      responsibleTeacher = teacher;
    } else if (body.responsibleTeacherId !== undefined) {
      responsibleTeacher = body.responsibleTeacherId
        ? await this.prisma.teacher.findUnique({
            where: { id: body.responsibleTeacherId },
            select: { id: true, name: true, cref: true },
          })
        : null;
      if (body.responsibleTeacherId && !responsibleTeacher) {
        throw new NotFoundException('Professor responsável não encontrado');
      }
    }

    const authorName = (
      profile.fullName.trim() || user.email || 'Usuário autorizado'
    ).slice(0, 160);

    const responsibleSnapshot =
      responsibleTeacher === undefined
        ? {}
        : {
            responsibleTeacherId: responsibleTeacher?.id ?? null,
            responsibleTeacherName: responsibleTeacher?.name ?? null,
            responsibleTeacherCref: responsibleTeacher?.cref ?? null,
          };

    const saved = await this.prisma.studentProgressReportObservation.upsert({
      where: {
        studentId_seasonId: { studentId, seasonId: body.seasonId },
      },
      create: {
        studentId,
        seasonId: body.seasonId,
        observation: body.observation,
        createdByProfileId: user.id,
        createdByName: authorName,
        updatedByProfileId: user.id,
        updatedByName: authorName,
        ...responsibleSnapshot,
      },
      update: {
        observation: body.observation,
        updatedByProfileId: user.id,
        updatedByName: authorName,
        ...responsibleSnapshot,
      },
    });
    return {
      seasonId: saved.seasonId,
      updatedAt: saved.updatedAt,
    };
  }

  async listSeasons(studentId: string, user: AuthUser) {
    if (user.role !== 'admin' && user.role !== 'teacher') {
      throw new NotFoundException('Aluno não encontrado');
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
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Aluno não encontrado');

    const seasons = await this.prisma.season.findMany({
      select: {
        id: true,
        label: true,
        year: true,
        startsOn: true,
        endsOn: true,
      },
      orderBy: { year: 'desc' },
      take: 30,
    });
    return seasons.map((season) => ({
      id: season.id,
      label: season.label,
      year: season.year,
      from: isoDate(season.startsOn),
      to: isoDate(season.endsOn),
    }));
  }
}
