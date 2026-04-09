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

const RESULT_DISCIPLINE_LABELS: Record<string, NonNullable<Result['discipline']>> = {
  Piscina: 'Piscina',
  Aguas_Abertas: 'Aguas Abertas',
}

const RESULT_COURSE_TYPE_LABELS: Record<string, NonNullable<Result['courseType']>> = {
  Piscina_Curta: 'Piscina Curta',
  Piscina_Longa: 'Piscina Longa',
  Mar: 'Mar',
  Rio: 'Rio',
  Lago: 'Lago',
  Represa: 'Represa',
}

const RESULT_EVENT_FORMAT_LABELS: Record<string, NonNullable<Result['eventFormat']>> = {
  Prova_Individual: 'Prova Individual',
  Travessia: 'Travessia',
  Knockout_Sprint: 'Knockout Sprint',
  Revezamento: 'Revezamento',
}

export class PrismaResultMapper {
  static toDomain(result: PrismaResultRecord): Result {
    return {
      id: result.id,
      studentId: result.studentId,
      studentName: result.student.name,
      discipline: RESULT_DISCIPLINE_LABELS[result.discipline] ?? 'Piscina',
      style: result.style as Result['style'],
      distance: result.distance,
      customDistance: result.customDistance || '',
      competitionType: result.competitionType || '',
      courseType: RESULT_COURSE_TYPE_LABELS[result.courseType],
      eventFormat: RESULT_EVENT_FORMAT_LABELS[result.eventFormat] ?? 'Prova Individual',
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
