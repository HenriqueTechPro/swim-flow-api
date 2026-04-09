import type {
  ResultCourseType,
  ResultDiscipline,
  ResultEventFormat,
  ResultStatus,
  ResultStyle,
} from '@/shared/contracts/results.contracts'

export interface CreateResultRequest {
  studentId: string
  discipline: ResultDiscipline
  style: ResultStyle
  distance: string
  customDistance?: string
  competitionType?: string
  courseType?: ResultCourseType
  eventFormat?: ResultEventFormat
  time: string
  date: string
  competition?: string
  position?: number
  resultStatus?: ResultStatus
  category?: string
  notes?: string
}

export interface UpdateResultRequest {
  studentId: string
  discipline: ResultDiscipline
  style: ResultStyle
  distance: string
  customDistance?: string
  competitionType?: string
  courseType?: ResultCourseType
  eventFormat?: ResultEventFormat
  time: string
  timeInSeconds: number
  date: string
  competition?: string
  position?: number
  resultStatus?: ResultStatus
  personalBest: boolean
  improvement: number
  category?: string
  notes?: string
}
