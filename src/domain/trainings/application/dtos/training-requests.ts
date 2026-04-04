export interface CreateTrainingRequest {
  title: string
  description?: string
  type: 'Técnico' | 'Resistência' | 'Velocidade' | 'Misto'
  dayOfWeek: string
  startTime: string
  endTime: string
  instructorId?: string | null
  level: 'Iniciante' | 'Intermediário' | 'Avançado' | 'Todos'
  maxParticipants: number
  currentParticipants: number
  status: 'Ativo' | 'Pausado' | 'Encerrado'
  venueType: 'Piscina' | 'Mar' | 'Rio' | 'Lago' | 'Represa' | 'Outro'
  locationName?: string
  poolId?: string | null
}

export interface UpdateTrainingRequest extends CreateTrainingRequest {}