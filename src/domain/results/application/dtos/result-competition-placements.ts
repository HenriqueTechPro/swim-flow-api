import type { ResultStyle } from '../../enterprise/entities/result';
import type { PaginationParams } from '@/domain/shared/pagination/pagination-params';

export interface ListCompetitionPlacementsRequest extends PaginationParams {
  competition: string;
  date: string;
  category: string;
  gender: 'Masculino' | 'Feminino';
  style: Exclude<ResultStyle, 'Nao informado'>;
  distance: string;
  poolLengthMeters: number;
}

export interface CompetitionPlacement {
  resultId: string;
  studentId: string;
  studentName: string;
  position: number;
  durationMs: number;
  time: string;
  competition: string;
  date: string;
  category: string;
  discipline: 'Piscina';
  eventFormat: 'Prova Individual';
  gender: 'Masculino' | 'Feminino';
  style: Exclude<ResultStyle, 'Nao informado'>;
  distance: string;
  poolLengthMeters: number;
}
