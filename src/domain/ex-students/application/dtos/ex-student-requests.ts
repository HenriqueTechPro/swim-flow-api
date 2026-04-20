import type { ExStudentExitReason } from '@/domain/ex-students/enterprise/entities/ex-student';

export interface CreateExStudentRequest {
  studentId: string;
  exitDate: string;
  exitReason: ExStudentExitReason;
  exitNotes?: string;
  lastCompetition?: string;
}

export interface UpdateExStudentRequest {
  exitDate: string;
  exitReason: ExStudentExitReason;
  exitNotes?: string;
  achievements: number;
  lastCompetition: string;
}
