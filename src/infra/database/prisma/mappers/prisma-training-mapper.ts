import type { Training } from '@/domain/trainings/enterprise/entities/training'

export interface PrismaTrainingRecord {
  id: string
  title: string
  description: string
  type: string
  dayOfWeek: string
  startTime: Date
  endTime: Date
  instructorId: string | null
  level: string
  maxParticipants: number
  currentParticipants?: number | null
  status: string
  venueType: string
  locationName: string
  poolId: string | null
  instructor: {
    name: string
  } | null
  pool: {
    name: string
    lengthMeters: number
  } | null
  enrollments?: Array<{
    student: {
      id: string
      name: string
      category: { name: string }
      level: { name: string }
    }
  }>
  _count?: {
    enrollments: number
  }
}

const TRAINING_TYPE_LABELS: Record<string, Training['type']> = {
  Tecnico: 'Técnico',
  Resistencia: 'Resistência',
  Velocidade: 'Velocidade',
  Misto: 'Misto',
}

const TRAINING_DAY_LABELS: Record<string, Training['dayOfWeek']> = {
  Segunda_feira: 'Segunda-feira',
  Terca_feira: 'Terça-feira',
  Quarta_feira: 'Quarta-feira',
  Quinta_feira: 'Quinta-feira',
  Sexta_feira: 'Sexta-feira',
  Sabado: 'Sábado',
  Domingo: 'Domingo',
}

const TRAINING_LEVEL_LABELS: Record<string, Training['level']> = {
  Iniciante: 'Iniciante',
  Intermediario: 'Intermediário',
  Avancado: 'Avançado',
  Todos: 'Todos',
}

const TRAINING_VENUE_LABELS: Record<string, Training['venueType']> = {
  Piscina: 'Piscina',
  Mar: 'Mar',
  Rio: 'Rio',
  Lago: 'Lago',
  Represa: 'Represa',
  Outro: 'Outro',
}

const formatTime = (value: Date) => value.toISOString().slice(11, 16)
const formatPoolLabel = (pool: { name: string; lengthMeters: number }) => `${pool.name} (${pool.lengthMeters}m)`

export class PrismaTrainingMapper {
  static toDomain(training: PrismaTrainingRecord): Training {
    const venueType = TRAINING_VENUE_LABELS[training.venueType] ?? 'Outro'
    const poolLabel = training.pool ? formatPoolLabel(training.pool) : ''

    return {
      id: training.id,
      title: training.title,
      description: training.description,
      type: TRAINING_TYPE_LABELS[training.type] ?? 'Misto',
      dayOfWeek: TRAINING_DAY_LABELS[training.dayOfWeek] ?? 'Segunda-feira',
      startTime: formatTime(training.startTime),
      endTime: formatTime(training.endTime),
      instructorId: training.instructorId ?? '',
      instructor: training.instructor?.name ?? '',
      level: TRAINING_LEVEL_LABELS[training.level] ?? 'Todos',
      maxParticipants: training.maxParticipants,
      currentParticipants: training._count?.enrollments ?? training.currentParticipants ?? 0,
      status: training.status as Training['status'],
      venueType,
      locationName: venueType === 'Piscina' ? poolLabel : training.locationName,
      poolId: training.poolId ?? undefined,
      pool: poolLabel,
      enrolledStudents:
        training.enrollments?.map((enrollment) => ({
          id: enrollment.student.id,
          name: enrollment.student.name,
          category: enrollment.student.category.name,
          level: enrollment.student.level.name,
        })) ?? [],
    }
  }
}
