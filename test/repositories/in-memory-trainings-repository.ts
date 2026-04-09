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
  public enrollments: Array<{ trainingId: string; studentId: string }> = []

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
      currentParticipants: input.currentParticipants ?? 0,
      status: input.status,
      venueType: input.venueType,
      locationName: input.venueType === 'Piscina' ? '' : input.locationName ?? '',
      poolId: input.poolId ?? undefined,
      enrolledStudents: [],
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
      currentParticipants: input.currentParticipants ?? this.items[itemIndex].currentParticipants,
      status: input.status,
      venueType: input.venueType,
      locationName: input.venueType === 'Piscina' ? '' : input.locationName ?? '',
      poolId: input.poolId ?? undefined,
    }

    this.items[itemIndex] = updatedTraining
    return updatedTraining
  }

  async enroll(trainingId: string, studentId: string): Promise<Training> {
    const training = this.items.find((item) => item.id === trainingId)
    if (!training) throw new AppError(404, 'Training not found')

    if (this.enrollments.some((item) => item.trainingId === trainingId && item.studentId === studentId)) {
      throw new AppError(409, 'Student already enrolled in training')
    }

    const currentParticipants = this.enrollments.filter((item) => item.trainingId === trainingId).length
    if (currentParticipants >= training.maxParticipants) {
      throw new AppError(409, 'Training has reached max participants')
    }

    this.enrollments.push({ trainingId, studentId })
    training.currentParticipants = currentParticipants + 1
    training.enrolledStudents = [
      ...training.enrolledStudents,
      { id: studentId, name: `Aluno ${studentId}`, category: '', level: '' },
    ]
    return training
  }

  async unenroll(trainingId: string, studentId: string): Promise<Training> {
    const training = this.items.find((item) => item.id === trainingId)
    if (!training) throw new AppError(404, 'Training not found')

    const enrollmentIndex = this.enrollments.findIndex(
      (item) => item.trainingId === trainingId && item.studentId === studentId,
    )

    if (enrollmentIndex < 0) throw new AppError(404, 'Enrollment not found')

    this.enrollments.splice(enrollmentIndex, 1)
    training.currentParticipants = this.enrollments.filter((item) => item.trainingId === trainingId).length
    training.enrolledStudents = training.enrolledStudents.filter((student) => student.id !== studentId)
    return training
  }

  async remove(id: string): Promise<Training> {
    const itemIndex = this.items.findIndex((item) => item.id === id)
    if (itemIndex < 0) throw new AppError(404, 'Training not found')

    const [removedTraining] = this.items.splice(itemIndex, 1)
    return removedTraining
  }
}
