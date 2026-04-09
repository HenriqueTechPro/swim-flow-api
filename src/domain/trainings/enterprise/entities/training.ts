export interface Training {
  id: string
  title: string
  description: string
  type: 'Técnico' | 'Resistência' | 'Velocidade' | 'Misto'
  dayOfWeek:
    | 'Segunda-feira'
    | 'Terça-feira'
    | 'Quarta-feira'
    | 'Quinta-feira'
    | 'Sexta-feira'
    | 'Sábado'
    | 'Domingo'
  startTime: string
  endTime: string
  instructorId: string
  instructor: string
  level: 'Iniciante' | 'Intermediário' | 'Avançado' | 'Todos'
  maxParticipants: number
  currentParticipants: number
  status: 'Ativo' | 'Pausado' | 'Encerrado'
  venueType: 'Piscina' | 'Mar' | 'Rio' | 'Lago' | 'Represa' | 'Outro'
  locationName: string
  poolId?: string
  pool: string
  enrolledStudents: Array<{
    id: string
    name: string
    category: string
    level: string
  }>
}
