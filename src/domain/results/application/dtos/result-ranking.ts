import type {
  ResultCompetitionType,
  ResultCourseType,
  ResultDiscipline,
  ResultDistance,
  ResultEventFormat,
  ResultStyle,
} from '../../enterprise/entities/result';
import type { PaginationParams } from '@/domain/shared/pagination/pagination-params';

export interface GenerateRankingRequest extends PaginationParams {
  discipline: ResultDiscipline;
  competitionType: ResultCompetitionType;
  courseType?: ResultCourseType;
  style: ResultStyle;
  distance: ResultDistance;
  customDistance?: string;
  eventFormat: ResultEventFormat;
  category: string;
}

export interface ResultRankingEntry {
  rank: number;
  resultId: string;
  studentId: string;
  studentName: string;
  discipline: ResultDiscipline;
  competitionType: ResultCompetitionType;
  courseType?: ResultCourseType;
  style: ResultStyle;
  distance: ResultDistance;
  customDistance?: string;
  eventFormat: ResultEventFormat;
  category: string;
  time: string;
  timeInSeconds: number;
  date: string;
  competition: string;
}
