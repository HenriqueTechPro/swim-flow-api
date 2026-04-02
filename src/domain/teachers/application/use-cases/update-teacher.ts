import { Injectable } from '@nestjs/common'
import type { UpdateTeacherRequest } from '../dtos/teacher-requests'
import { TeachersRepository } from '../repositories/teachers-repository'

@Injectable()
export class UpdateTeacherUseCase {
  constructor(private readonly teachersRepository: TeachersRepository) {}

  async execute(id: string, input: UpdateTeacherRequest) {
    const teacher = await this.teachersRepository.update(id, input)

    return {
      teacher,
    }
  }
}
