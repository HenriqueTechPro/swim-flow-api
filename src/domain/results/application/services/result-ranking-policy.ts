import type { Result } from '../../enterprise/entities/result';
import type { ResultRankingEntry } from '../dtos/result-ranking';

export class ResultRankingPolicy {
  static build(results: Result[]): ResultRankingEntry[] {
    const bestResultsByStudent = new Map<string, Result>();

    const sortedResults = [...results]
      .filter((result) => result.resultStatus === 'Classificado')
      .sort((left, right) => {
        if (left.timeInSeconds !== right.timeInSeconds) {
          return left.timeInSeconds - right.timeInSeconds;
        }

        if (left.date !== right.date) {
          return left.date.localeCompare(right.date);
        }

        return left.studentName.localeCompare(right.studentName);
      });

    for (const result of sortedResults) {
      if (!bestResultsByStudent.has(result.studentId)) {
        bestResultsByStudent.set(result.studentId, result);
      }
    }

    let previousTimeInSeconds: number | null = null;
    let previousRank = 0;

    return [...bestResultsByStudent.values()].map((result, index) => {
      const rank =
        previousTimeInSeconds !== null &&
        result.timeInSeconds === previousTimeInSeconds
          ? previousRank
          : index + 1;

      previousTimeInSeconds = result.timeInSeconds;
      previousRank = rank;

      return {
        rank,
        resultId: result.id,
        studentId: result.studentId,
        studentName: result.studentName,
        discipline: result.discipline,
        competitionType: result.competitionType,
        courseType: result.courseType,
        style: result.style,
        distance: result.distance,
        customDistance: result.customDistance,
        eventFormat: result.eventFormat,
        category: result.category,
        time: result.time,
        timeInSeconds: result.timeInSeconds,
        date: result.date,
        competition: result.competition,
      };
    });
  }
}
