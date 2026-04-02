import { Injectable } from '@nestjs/common'
import type { TransferTeacherRequest } from '../dtos/class-requests'
import { ClassesRepository } from '../repositories/classes-repository'

@Injectable()
export class TransferClassTeacherUseCase {
  constructor(private readonly classesRepository: ClassesRepository) {}

  async execute(input: TransferTeacherRequest) {
    const classItem = await this.classesRepository.transferTeacher(input)

    return {
      classItem,
    }
  }
}
