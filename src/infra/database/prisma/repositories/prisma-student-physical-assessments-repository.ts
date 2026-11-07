import { Injectable } from '@nestjs/common';
import { AppError } from '@/shared/errors/app-error';
import { AnthropometryPolicy } from '@/domain/assessments/application/services/anthropometry.policy';
import {
  StudentPhysicalAssessmentsRepository,
  type CreateStudentPhysicalAssessmentInput,
  type StudentPhysicalAssessment,
} from '@/domain/assessments/application/repositories/student-physical-assessments-repository';
import { PrismaService } from '../prisma.service';

const selection = {
  id: true,
  studentId: true,
  measuredOn: true,
  heightCm: true,
  bodyMassKg: true,
  armSpanCm: true,
  legLengthCm: true,
  footLengthCm: true,
  handLengthCm: true,
  trunkLengthCm: true,
  measurementMethod: true,
  notes: true,
  assessorTeacherId: true,
} as const;

type Row = {
  id: string;
  studentId: string;
  measuredOn: Date;
  heightCm: { toNumber(): number } | null;
  bodyMassKg: { toNumber(): number } | null;
  armSpanCm: { toNumber(): number } | null;
  legLengthCm: { toNumber(): number } | null;
  footLengthCm: { toNumber(): number } | null;
  handLengthCm: { toNumber(): number } | null;
  trunkLengthCm: { toNumber(): number } | null;
  measurementMethod: string | null;
  notes: string | null;
  assessorTeacherId: string | null;
};

const toHttpRecord = (row: Row): StudentPhysicalAssessment => {
  const measurements = {
    heightCm: row.heightCm?.toNumber() ?? null,
    bodyMassKg: row.bodyMassKg?.toNumber() ?? null,
    armSpanCm: row.armSpanCm?.toNumber() ?? null,
    legLengthCm: row.legLengthCm?.toNumber() ?? null,
    footLengthCm: row.footLengthCm?.toNumber() ?? null,
    handLengthCm: row.handLengthCm?.toNumber() ?? null,
    trunkLengthCm: row.trunkLengthCm?.toNumber() ?? null,
  };
  return {
    id: row.id,
    studentId: row.studentId,
    measuredOn: row.measuredOn.toISOString().slice(0, 10),
    ...measurements,
    measurementMethod: row.measurementMethod,
    notes: row.notes,
    assessorTeacherId: row.assessorTeacherId,
    ...AnthropometryPolicy.validateAndDerive(measurements),
  };
};

@Injectable()
export class PrismaStudentPhysicalAssessmentsRepository
  implements StudentPhysicalAssessmentsRepository
{
  constructor(private readonly prisma: PrismaService) {}

  private async assertStudentExists(studentId: string): Promise<void> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true },
    });
    if (!student) throw new AppError(404, 'Student not found');
  }

  async list(studentId: string): Promise<StudentPhysicalAssessment[]> {
    await this.assertStudentExists(studentId);
    const records = await this.prisma.anthropometricAssessment.findMany({
      where: { studentId },
      select: selection,
      orderBy: [
        { measuredOn: 'desc' },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: 50,
    });
    return records.map(toHttpRecord);
  }

  async create(
    studentId: string,
    input: CreateStudentPhysicalAssessmentInput,
  ): Promise<StudentPhysicalAssessment> {
    await this.assertStudentExists(studentId);
    const record = await this.prisma.anthropometricAssessment.create({
      data: {
        studentId,
        measuredOn: new Date(`${input.measuredOn}T00:00:00.000Z`),
        heightCm: input.heightCm ?? null,
        bodyMassKg: input.bodyMassKg ?? null,
        armSpanCm: input.armSpanCm ?? null,
        legLengthCm: input.legLengthCm ?? null,
        footLengthCm: input.footLengthCm ?? null,
        handLengthCm: input.handLengthCm ?? null,
        trunkLengthCm: input.trunkLengthCm ?? null,
        measurementMethod: input.measurementMethod ?? null,
        notes: input.notes ?? null,
      },
      select: selection,
    });
    return toHttpRecord(record);
  }
}
