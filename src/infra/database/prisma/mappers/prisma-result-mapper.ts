import type { Result } from '@/domain/results/enterprise/entities/result';

export interface PrismaResultRecord {
  id: string;
  studentId: string;
  discipline: string;
  style: string;
  distance: string;
  customDistance: string;
  competitionType: string;
  courseType: string;
  eventFormat: string;
  time: string;
  timeInSeconds: number;
  date: Date | null;
  competition: string;
  position: number;
  resultStatus: string;
  personalBest: boolean;
  improvement: number;
  category: string;
  notes: string | null;
  student: {
    name: string;
  };
}

export class PrismaResultMapper {
  static toDomain(this: void, result: PrismaResultRecord): Result {
    return {
      id: result.id,
      studentId: result.studentId,
      studentName: result.student.name,
      discipline: (result.discipline || 'Piscina') as Result['discipline'],
      style: result.style as Result['style'],
      distance: result.distance,
      customDistance: result.customDistance || undefined,
      competitionType: (result.competitionType ||
        result.discipline ||
        'Piscina') as Result['competitionType'],
      courseType: (result.courseType || undefined) as Result['courseType'],
      eventFormat: (result.eventFormat ||
        'Prova Individual') as Result['eventFormat'],
      time: result.time,
      timeInSeconds: Number(result.timeInSeconds),
      date: result.date ? result.date.toISOString().slice(0, 10) : '',
      competition: result.competition,
      position: result.position,
      resultStatus: (result.resultStatus ||
        'Classificado') as Result['resultStatus'],
      personalBest: result.personalBest,
      improvement: Number(result.improvement),
      category: result.category,
      notes: result.notes ?? undefined,
    };
  }
}
