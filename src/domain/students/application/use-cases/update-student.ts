import { Injectable } from '@nestjs/common'
import type { UpdateStudentRequest } from '../dtos/student-requests'
import { StudentsRepository } from '../repositories/students-repository'

@Injectable()
export class UpdateStudentUseCase {
  constructor(private readonly studentsRepository: StudentsRepository) {}

  async execute(id: string, input: UpdateStudentRequest) {
    const student = await this.studentsRepository.update(id, input)

    return {
      student,
    }
  }
}
