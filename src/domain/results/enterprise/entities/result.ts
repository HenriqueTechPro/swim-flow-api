export type ResultStyle = 'Livre' | 'Costas' | 'Peito' | 'Borboleta' | 'Medley';
export type ResultDistance = string;
export type ResultDiscipline = 'Piscina' | 'Aguas Abertas';
export type ResultCompetitionType = ResultDiscipline;
export type ResultCourseType =
  | 'Piscina Curta'
  | 'Piscina Longa'
  | 'Mar'
  | 'Rio'
  | 'Lago'
  | 'Represa';
export type ResultEventFormat =
  | 'Prova Individual'
  | 'Revezamento'
  | 'Travessia'
  | 'Knockout Sprint'
  | 'Ultramaratona';
export type ResultStatus = 'Classificado' | 'Desclassificado';

export interface Result {
  id: string;
  studentId: string;
  studentName: string;
  discipline: ResultDiscipline;
  style: ResultStyle;
  distance: ResultDistance;
  customDistance?: string;
  competitionType: ResultCompetitionType;
  courseType?: ResultCourseType;
  eventFormat: ResultEventFormat;
  time: string;
  timeInSeconds: number;
  date: string;
  competition: string;
  position: number;
  resultStatus: ResultStatus;
  personalBest: boolean;
  improvement: number;
  category: string;
  notes?: string;
}
