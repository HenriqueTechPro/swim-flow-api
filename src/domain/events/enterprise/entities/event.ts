export interface Event {
  id: string
  title: string
  description: string
  type: 'Competição' | 'Reunião' | 'Festival' | 'Outro'
  date: string
  startTime: string
  endTime: string
  location: string
  status: 'Agendado' | 'Em Andamento' | 'Concluído' | 'Cancelado'
}
