import { AppError } from '@/shared/errors/app-error'
import type {
  CreateTrainingRepositoryInput,
  ListTrainingsRepositoryParams,
  UpdateTrainingRepositoryInput,
} from '@/domain/trainings/application/repositories/trainings-repository'
import { TrainingsRepository } from '@/domain/trainings/application/repositories/trainings-repository'
import type { Training } from '@/domain/trainings/enterprise/entities/training'
import { paginateItems } from '@/domain/shared/pagination/pagination-utils'
import { makeTraining } from '../factories/make-training'

export class InMemoryTrainingsRepository implements TrainingsRepository {
  public items: Training[] = []

  async list(params?: ListTrainingsRepositoryParams) {
    const search = params?.search?.trim().toLowerCase()
    const type = params?.type?.trim()
    const status = params?.status?.trim()
    const poolId = params?.poolId?.trim()

    const filtered = this.items.filter((training) => {
      const matchesSearch =
        !search ||
        training.title.toLowerCase().includes(search) ||
        training.description.toLowerCase().includes(search) ||
        training.instructor.toLowerCase().includes(search) ||
        training.pool.toLowerCase().includes(search)
      const matchesType = !type || training.type === type
      const matchesStatus = !status || training.status === status
      const matchesPool = !poolId || training.poolId === poolId

      return matchesSearch && matchesType && matchesStatus && matchesPool
    })

    return paginateItems([...filtered], params)
  }

  async create(input: CreateTrainingRepositoryInput): Promise<Training> {
    const training = makeTraining({
      title: input.title,
      description: input.description ?? '',
      type: input.type,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      instructorId: input.instructorId ?? '',
      level: input.level,
      maxParticipants: input.maxParticipants,
      currentParticipants: input.currentParticipants,
      status: input.status,
      venueType: input.venueType,
      locationName: input.venueType === 'Piscina' ? '' : input.locationName ?? '',
      poolId: input.poolId ?? undefined,
    })

    this.items.push(training)
    return training
  }

  async update(id: string, input: UpdateTrainingRepositoryInput): Promise<Training> {
    const itemIndex = this.items.findIndex((item) => item.id === id)
    if (itemIndex < 0) throw new AppError(404, 'Training not found')

    const updatedTraining: Training = {
      ...this.items[itemIndex],
      title: input.title,
      description: input.description ?? '',
      type: input.type,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      instructorId: input.instructorId ?? '',
      level: input.level,
      maxParticipants: input.maxParticipants,
      currentParticipants: input.currentParticipants,
      status: input.status,
      venueType: input.venueType,
      locationName: input.venueType === 'Piscina' ? '' : input.locationName ?? '',
      poolId: input.poolId ?? undefined,
    }

    this.items[itemIndex] = updatedTraining
    return updatedTraining
  }

  async remove(id: string): Promise<Training> {
    const itemIndex = this.items.findIndex((item) => item.id === id)
    if (itemIndex < 0) throw new AppError(404, 'Training not found')

    const [removedTraining] = this.items.splice(itemIndex, 1)
    return removedTraining
  }
}
