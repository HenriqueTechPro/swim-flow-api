import type { ExStudent, ExStudentExitReason } from '@/domain/ex-students/enterprise/entities/ex-student';
import type { ExStudentExitReason as PrismaExStudentExitReason } from '@prisma/client';

export interface PrismaExStudentRecord {
  id: string;
  studentId: string | null;
  name: string;
  category: string;
  categorySnapshot: string | null;
  exitDateAt: Date;
  exitReason: PrismaExStudentExitReason;
  exitNotes: string | null;
  phone: string;
  responsible: string;
  responsibleSnapshot: string | null;
  parentId: string | null;
  achievements: number;
  lastCompetition: string;
  birthYear: number;
  birthDate: Date | null;
  level: string;
  levelSnapshot: string | null;
}

const EXIT_REASON_LABELS: Record<PrismaExStudentExitReason, ExStudentExitReason> = {
  Mudanca_de_cidade: 'Mudança de cidade',
  Falta_de_tempo: 'Falta de tempo',
  Interesse_por_outro_esporte: 'Interesse por outro esporte',
  Idade_limite_da_categoria: 'Idade limite da categoria',
  Motivos_financeiros: 'Motivos financeiros',
  Motivos_de_saude: 'Motivos de saúde',
  Outro: 'Outro',
};

const EXIT_REASON_KEYS: Record<ExStudentExitReason, PrismaExStudentExitReason> = {
  'Mudança de cidade': 'Mudanca_de_cidade',
  'Falta de tempo': 'Falta_de_tempo',
  'Interesse por outro esporte': 'Interesse_por_outro_esporte',
  'Idade limite da categoria': 'Idade_limite_da_categoria',
  'Motivos financeiros': 'Motivos_financeiros',
  'Motivos de saúde': 'Motivos_de_saude',
  Outro: 'Outro',
};

export const EX_STUDENT_EXIT_REASON_LABELS = Object.values(EXIT_REASON_LABELS);

export const toPrismaExStudentExitReason = (
  value: ExStudentExitReason,
): PrismaExStudentExitReason => EXIT_REASON_KEYS[value];

export class PrismaExStudentMapper {
  static toDomain(this: void, exStudent: PrismaExStudentRecord): ExStudent {
    return {
      id: exStudent.id,
      studentId: exStudent.studentId ?? undefined,
      name: exStudent.name,
      category: exStudent.categorySnapshot || exStudent.category,
      exitDate: exStudent.exitDateAt.toISOString().slice(0, 10),
      exitReason: EXIT_REASON_LABELS[exStudent.exitReason],
      exitNotes: exStudent.exitNotes ?? undefined,
      phone: exStudent.phone,
      responsible: exStudent.responsibleSnapshot || exStudent.responsible,
      parentId: exStudent.parentId ?? undefined,
      achievements: exStudent.achievements,
      lastCompetition: exStudent.lastCompetition,
      birthYear: exStudent.birthDate
        ? Number(exStudent.birthDate.toISOString().slice(0, 4))
        : exStudent.birthYear,
      level: exStudent.levelSnapshot || exStudent.level,
    };
  }
}
