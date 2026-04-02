import { Injectable } from '@nestjs/common'
import type { CreateClassRequest } from '../dtos/class-requests'
import { ClassesRepository } from '../repositories/classes-repository'

@Injectable()
export class CreateClassUseCase {
  constructor(private readonly classesRepository: ClassesRepository) {}

  async execute(input: CreateClassRequest) {
    const classItem = await this.classesRepository.create(input)

    return {
      classItem,
    }
  }
}
