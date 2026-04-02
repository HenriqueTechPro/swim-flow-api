import { Injectable } from '@nestjs/common'
import type { UpdateClassRequest } from '../dtos/class-requests'
import { ClassesRepository } from '../repositories/classes-repository'

@Injectable()
export class UpdateClassUseCase {
  constructor(private readonly classesRepository: ClassesRepository) {}

  async execute(id: string, input: UpdateClassRequest) {
    const classItem = await this.classesRepository.update(id, input)

    return {
      classItem,
    }
  }
}
