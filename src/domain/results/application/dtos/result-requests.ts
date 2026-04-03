export interface CreateResultRequest {
  studentId: string
  discipline: string
  style: string
  distance: string
  customDistance?: string
  competitionType?: string
  courseType?: string
  eventFormat?: string
  time: string
  date: string
  competition?: string
  position?: number
  resultStatus?: 'Classificado' | 'Desclassificado'
  category?: string
  notes?: string
}

export interface UpdateResultRequest {
  studentId: string
  discipline: string
  style: string
  distance: string
  customDistance?: string
  competitionType?: string
  courseType?: string
  eventFormat?: string
  time: string
  timeInSeconds: number
  date: string
  competition?: string
  position?: number
  resultStatus?: 'Classificado' | 'Desclassificado'
  personalBest: boolean
  improvement: number
  category?: string
  notes?: string
}
