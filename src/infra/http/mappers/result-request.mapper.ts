import type { CreateResultDto, UpdateResultDto } from '@/shared/contracts/results.contracts'
import type { CreateResultRequest, UpdateResultRequest } from '@/domain/results/application/dtos/result-requests'

export class ResultRequestMapper {
  static toCreate(body: CreateResultDto): CreateResultRequest {
    return {
      studentId: body.studentId,
      discipline: body.discipline,
      style: body.style,
      distance: body.distance,
      customDistance: body.customDistance,
      competitionType: body.competitionType,
      courseType: body.courseType,
      eventFormat: body.eventFormat,
      time: body.time,
      date: body.date,
      competition: body.competition,
      position: body.position,
      resultStatus: body.resultStatus,
      category: body.category,
      notes: body.notes,
    }
  }

  static toUpdate(body: UpdateResultDto): UpdateResultRequest {
    return {
      studentId: body.studentId,
      discipline: body.discipline,
      style: body.style,
      distance: body.distance,
      customDistance: body.customDistance,
      competitionType: body.competitionType,
      courseType: body.courseType,
      eventFormat: body.eventFormat,
      time: body.time,
      timeInSeconds: body.timeInSeconds,
      date: body.date,
      competition: body.competition,
      position: body.position,
      resultStatus: body.resultStatus,
      personalBest: body.personalBest,
      improvement: body.improvement,
      category: body.category,
      notes: body.notes,
    }
  }
}
