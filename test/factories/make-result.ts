import type { Result } from '@/domain/results/enterprise/entities/result'

interface MakeResultOverride extends Partial<Result> {}

export function makeResult(override: MakeResultOverride = {}): Result {
  return {
    id: override.id ?? crypto.randomUUID(),
    studentId: override.studentId ?? crypto.randomUUID(),
    studentName: override.studentName ?? 'Aluno Teste',
    discipline: override.discipline ?? 'Piscina',
    style: override.style ?? 'Livre',
    distance: override.distance ?? '50m',
    customDistance: override.customDistance ?? '',
    competitionType: override.competitionType ?? 'Piscina',
    courseType: override.courseType ?? 'Piscina Curta',
    eventFormat: override.eventFormat ?? 'Prova Individual',
    time: override.time ?? '00:34.21',
    timeInSeconds: override.timeInSeconds ?? 34.21,
    date: override.date ?? '2026-03-31',
    competition: override.competition ?? 'Festival Interno',
    position: override.position ?? 1,
    resultStatus: override.resultStatus ?? 'Classificado',
    personalBest: override.personalBest ?? false,
    improvement: override.improvement ?? 0,
    category: override.category ?? 'Petiz 2',
    notes: override.notes ?? '',
  }
}
