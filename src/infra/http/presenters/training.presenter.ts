import type { Training } from '@/domain/trainings/enterprise/entities/training'

export class TrainingPresenter {
  static toHTTP(training: Training) {
    return {
      id: training.id,
      title: training.title,
      description: training.description,
      type: training.type,
      dayOfWeek: training.dayOfWeek,
      startTime: training.startTime,
      endTime: training.endTime,
      instructorId: training.instructorId,
      instructor: training.instructor,
      level: training.level,
      maxParticipants: training.maxParticipants,
      currentParticipants: training.currentParticipants,
      status: training.status,
      poolId: training.poolId,
      pool: training.pool,
    }
  }
}
