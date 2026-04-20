import type {
  ResultCompetitionType,
  ResultCourseType,
  ResultDistance,
  ResultDiscipline,
  ResultEventFormat,
  ResultStatus,
  ResultStyle,
} from '../../enterprise/entities/result';

export interface CreateResultRequest {
  studentId: string;
  discipline: ResultDiscipline;
  style: ResultStyle;
  distance: ResultDistance;
  customDistance?: string;
  competitionType: ResultCompetitionType;
  courseType?: ResultCourseType;
  eventFormat: ResultEventFormat;
  time: string;
  date: string;
  competition?: string;
  position?: number;
  resultStatus: ResultStatus;
  category?: string;
  notes?: string;
}

export interface UpdateResultRequest extends CreateResultRequest {
  personalBest: boolean;
  improvement: number;
}
