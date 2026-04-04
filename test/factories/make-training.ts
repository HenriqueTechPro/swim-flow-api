import type { Training } from '@/domain/trainings/enterprise/entities/training'

interface MakeTrainingOverride extends Partial<Training> {}

export function makeTraining(override: MakeTrainingOverride = {}): Training {
  return {
    id: override.id ?? crypto.randomUUID(),
    title: override.title ?? 'Treino Teste',
    description: override.description ?? '',
    type: override.type ?? 'Misto',
    dayOfWeek: override.dayOfWeek ?? 'Segunda',
    startTime: override.startTime ?? '18:00',
    endTime: override.endTime ?? '19:00',
    instructorId: override.instructorId ?? crypto.randomUUID(),
    instructor: override.instructor ?? 'Professor Teste',
    level: override.level ?? 'Todos',
    maxParticipants: override.maxParticipants ?? 20,
    currentParticipants: override.currentParticipants ?? 0,
    status: override.status ?? 'Ativo',
    venueType: override.venueType ?? 'Piscina',
    locationName: override.locationName ?? '',
    poolId: override.poolId,
    pool: override.pool ?? '',
  }
}
