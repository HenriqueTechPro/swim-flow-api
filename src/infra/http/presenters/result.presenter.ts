import type { Result } from '@/domain/results/enterprise/entities/result'

export class ResultPresenter {
  static toHTTP(result: Result) {
    return {
      id: result.id,
      studentId: result.studentId,
      studentName: result.studentName,
      discipline: result.discipline,
      style: result.style,
      distance: result.distance,
      customDistance: result.customDistance,
      competitionType: result.competitionType,
      courseType: result.courseType,
      eventFormat: result.eventFormat,
      time: result.time,
      timeInSeconds: result.timeInSeconds,
      date: result.date,
      competition: result.competition,
      position: result.position,
      resultStatus: result.resultStatus,
      personalBest: result.personalBest,
      improvement: result.improvement,
      category: result.category,
      notes: result.notes,
    }
  }
}
