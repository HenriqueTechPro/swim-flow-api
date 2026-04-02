export interface Result {
  id: string
  studentId: string
  studentName: string
  style: 'Livre' | 'Costas' | 'Peito' | 'Borboleta'
  distance: '25m' | '50m' | '100m' | '200m'
  time: string
  timeInSeconds: number
  date: string
  competition: string
  position: number
  personalBest: boolean
  improvement: number
  category: string
  notes?: string
}
