import type { Event } from '@/domain/events/enterprise/entities/event'

export interface PrismaEventRecord {
  id: string
  title: string
  description: string
  type: string
  date: Date | null
  startTime: Date
  endTime: Date
  location: string
  status: string
}

const EVENT_TYPE_LABELS: Record<string, Event['type']> = {
  Competicao: 'Competição',
  Reuniao: 'Reunião',
  Festival: 'Festival',
  Outro: 'Outro',
}

const EVENT_STATUS_LABELS: Record<string, Event['status']> = {
  Agendado: 'Agendado',
  Em_Andamento: 'Em Andamento',
  Concluido: 'Concluído',
  Cancelado: 'Cancelado',
}

const formatTime = (value: Date) => value.toISOString().slice(11, 16)

export class PrismaEventMapper {
  static toDomain(event: PrismaEventRecord): Event {
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      type: EVENT_TYPE_LABELS[event.type] ?? 'Outro',
      date: event.date ? event.date.toISOString().slice(0, 10) : '',
      startTime: formatTime(event.startTime),
      endTime: formatTime(event.endTime),
      location: event.location,
      status: EVENT_STATUS_LABELS[event.status] ?? 'Agendado',
    }
  }
}
