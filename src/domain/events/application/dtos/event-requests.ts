export interface CreateEventRequest {
  title: string
  description?: string
  type: 'Competição' | 'Reunião' | 'Festival' | 'Outro'
  date: string
  startTime: string
  endTime: string
  location: string
  status: 'Agendado' | 'Em Andamento' | 'Concluído' | 'Cancelado'
}

export interface UpdateEventRequest extends CreateEventRequest {}
