import type { Event } from '@/domain/events/enterprise/entities/event'

export class EventPresenter {
  static toHTTP(event: Event) {
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      type: event.type,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      location: event.location,
      status: event.status,
    }
  }
}
