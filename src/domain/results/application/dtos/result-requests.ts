export interface CreateResultRequest {
  studentId: string
  style: 'Livre' | 'Costas' | 'Peito' | 'Borboleta'
  distance: '25m' | '50m' | '100m' | '200m'
  time: string
  date: string
  competition?: string
  position?: number
  category?: string
  notes?: string
}

export interface UpdateResultRequest extends CreateResultRequest {
  timeInSeconds: number
  personalBest: boolean
  improvement: number
}
