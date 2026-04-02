import type { CreateResultDto, UpdateResultDto } from '@/shared/contracts/management'
import type { CreateResultRequest, UpdateResultRequest } from '@/domain/results/application/dtos/result-requests'

export class ResultRequestMapper {
  static toCreate(body: CreateResultDto): CreateResultRequest {
    return {
      studentId: body.studentId,
      style: body.style,
      distance: body.distance,
      time: body.time,
      date: body.date,
      competition: body.competition,
      position: body.position,
      category: body.category,
      notes: body.notes,
    }
  }

  static toUpdate(body: UpdateResultDto): UpdateResultRequest {
    return {
      studentId: body.studentId,
      style: body.style,
      distance: body.distance,
      time: body.time,
      timeInSeconds: body.timeInSeconds,
      date: body.date,
      competition: body.competition,
      position: body.position,
      personalBest: body.personalBest,
      improvement: body.improvement,
      category: body.category,
      notes: body.notes,
    }
  }
}
