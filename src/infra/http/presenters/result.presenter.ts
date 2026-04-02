import type { Result } from '@/domain/results/enterprise/entities/result'

export class ResultPresenter {
  static toHTTP(result: Result) {
    return {
      id: result.id,
      studentId: result.studentId,
      studentName: result.studentName,
      style: result.style,
      distance: result.distance,
      time: result.time,
      timeInSeconds: result.timeInSeconds,
      date: result.date,
      competition: result.competition,
      position: result.position,
      personalBest: result.personalBest,
      improvement: result.improvement,
      category: result.category,
      notes: result.notes,
    }
  }
}
