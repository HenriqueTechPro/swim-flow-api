import { Injectable } from '@nestjs/common'
import type { TransferStudentRequest } from '../dtos/class-requests'
import { ClassesRepository } from '../repositories/classes-repository'

@Injectable()
export class TransferClassStudentUseCase {
  constructor(private readonly classesRepository: ClassesRepository) {}

  async execute(input: TransferStudentRequest) {
    const classItem = await this.classesRepository.transferStudent(input)

    return {
      classItem,
    }
  }
}
