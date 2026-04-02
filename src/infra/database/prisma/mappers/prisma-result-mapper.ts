import type { Result } from '@/domain/results/enterprise/entities/result'

export interface PrismaResultRecord {
  id: string
  studentId: string
  style: string
  distance: string
  time: string
  timeInSeconds: number
  date: Date | null
  competition: string
  position: number
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
      style: result.style as Result['style'],
      distance: result.distance as Result['distance'],
      time: result.time,
      timeInSeconds: Number(result.timeInSeconds),
      date: result.date ? result.date.toISOString().slice(0, 10) : '',
      competition: result.competition,
      position: result.position,
      personalBest: result.personalBest,
      improvement: Number(result.improvement),
      category: result.category,
      notes: result.notes ?? undefined,
    }
  }
}
