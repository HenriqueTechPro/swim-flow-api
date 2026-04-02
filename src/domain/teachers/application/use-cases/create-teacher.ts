import { Injectable } from '@nestjs/common'
import type { CreateTeacherRequest } from '../dtos/teacher-requests'
import { TeachersRepository } from '../repositories/teachers-repository'

@Injectable()
export class CreateTeacherUseCase {
  constructor(private readonly teachersRepository: TeachersRepository) {}

  async execute(input: CreateTeacherRequest) {
    const teacher = await this.teachersRepository.create(input)

    return {
      teacher,
    }
  }
}
