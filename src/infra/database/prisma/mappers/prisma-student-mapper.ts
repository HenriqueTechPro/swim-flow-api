import type { Student } from '@/domain/students/enterprise/entities/student';
import {
  formatCategoryLabel,
  formatEntityStatus,
} from '@/shared/utils/domain-formatters';

export interface PrismaStudentRecord {
  id: string;
  name: string;
  photo: string | null;
  gender: 'Masculino' | 'Feminino';
  birthDate: Date | null;
  phone: string;
  status: string;
  achievements: number;
  category: { name: string };
  level: { name: string };
  guardians: Array<{
    parentId: string;
    isPrimary: boolean;
    parent: { name: string; phone: string };
  }>;
  studentClasses: Array<{ classId: string }>;
}

const getBirthYearFromDate = (birthDate?: Date | null): number | null =>
  birthDate ? birthDate.getUTCFullYear() : null;

export class PrismaStudentMapper {
  static toDomain(this: void, student: PrismaStudentRecord): Student {
    const primaryGuardian = student.guardians.find((link) => link.isPrimary);
    return {
      id: student.id,
      name: student.name,
      photo: student.photo ?? undefined,
      gender: student.gender,
      birthDate: student.birthDate
        ? student.birthDate.toISOString().slice(0, 10)
        : '',
      birthYear: getBirthYearFromDate(student.birthDate),
      category: formatCategoryLabel(student.category.name),
      level: student.level.name,
      responsible: primaryGuardian?.parent.name ?? '',
      guardianPhone: primaryGuardian?.parent.phone,
      parentId: primaryGuardian?.parentId,
      classId: student.studentClasses[0]?.classId ?? null,
      phone: student.phone,
      status: formatEntityStatus(student.status),
      achievements: student.achievements,
    };
  }
}
