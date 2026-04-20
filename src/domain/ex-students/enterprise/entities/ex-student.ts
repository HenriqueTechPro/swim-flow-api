export type ExStudentExitReason =
  | 'Mudança de cidade'
  | 'Falta de tempo'
  | 'Interesse por outro esporte'
  | 'Idade limite da categoria'
  | 'Motivos financeiros'
  | 'Motivos de saúde'
  | 'Outro';

export interface ExStudent {
  id: string;
  studentId?: string;
  name: string;
  category: string;
  exitDate: string;
  exitReason: ExStudentExitReason;
  exitNotes?: string;
  phone: string;
  responsible: string;
  parentId?: string;
  achievements: number;
  lastCompetition: string;
  birthYear: number;
  level: string;
}
