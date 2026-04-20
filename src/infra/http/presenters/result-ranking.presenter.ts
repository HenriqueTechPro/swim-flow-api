import type { ResultRankingEntry } from '@/domain/results/application/dtos/result-ranking';

export class ResultRankingPresenter {
  static toHTTP(this: void, entry: ResultRankingEntry) {
    return {
      rank: entry.rank,
      resultId: entry.resultId,
      studentId: entry.studentId,
      studentName: entry.studentName,
      discipline: entry.discipline,
      competitionType: entry.competitionType,
      courseType: entry.courseType,
      style: entry.style,
      distance: entry.distance,
      customDistance: entry.customDistance,
      eventFormat: entry.eventFormat,
      category: entry.category,
      time: entry.time,
      timeInSeconds: entry.timeInSeconds,
      date: entry.date,
      competition: entry.competition,
    };
  }
}
