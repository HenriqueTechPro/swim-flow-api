import type { Event } from '@/domain/events/enterprise/entities/event'

interface MakeEventOverride extends Partial<Event> {}

export function makeEvent(override: MakeEventOverride = {}): Event {
  return {
    id: override.id ?? crypto.randomUUID(),
    title: override.title ?? 'Festival Teste',
    description: override.description ?? '',
    type: override.type ?? 'Festival',
    date: override.date ?? '2026-04-15',
    startTime: override.startTime ?? '08:00',
    endTime: override.endTime ?? '12:00',
    location: override.location ?? 'Piscina Principal',
    status: override.status ?? 'Agendado',
  }
}
