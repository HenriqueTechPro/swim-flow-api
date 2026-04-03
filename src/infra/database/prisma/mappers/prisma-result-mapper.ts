import type { Result } from '@/domain/results/enterprise/entities/result'

export interface PrismaResultRecord {
  id: string
  studentId: string
  discipline: string
  style: string
  distance: string
  customDistance: string
  competitionType: string
  courseType: string
  eventFormat: string
  time: string
  timeInSeconds: number
  date: Date | null
  competition: string
  position: number
  resultStatus: string
  personalBest: boolean
  improvement: number
  category: string
  notes: string | null
  student: {
    name: string
  }
}

export class PrismaResultMapper {
  static toDomain(result: PrismaResultRecord): Result {
    return {
      id: result.id,
      studentId: result.studentId,
      studentName: result.student.name,
      discipline: result.discipline || 'Piscina',
      style: result.style as Result['style'],
      distance: result.distance as Result['distance'],
      customDistance: result.customDistance || '',
      competitionType: result.competitionType || '',
      courseType: result.courseType || '',
      eventFormat: result.eventFormat || 'Prova Individual',
      time: result.time,
      timeInSeconds: Number(result.timeInSeconds),
      date: result.date ? result.date.toISOString().slice(0, 10) : '',
      competition: result.competition,
      position: result.position,
      resultStatus: (result.resultStatus as Result['resultStatus']) || 'Classificado',
      personalBest: result.personalBest,
      improvement: Number(result.improvement),
      category: result.category,
      notes: result.notes ?? undefined,
    }
  }
}
