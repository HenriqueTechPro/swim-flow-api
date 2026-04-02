import { Injectable } from '@nestjs/common'
import type { CreateStudentRequest } from '../dtos/student-requests'
import { StudentsRepository } from '../repositories/students-repository'

@Injectable()
export class CreateStudentUseCase {
  constructor(private readonly studentsRepository: StudentsRepository) {}

  async execute(input: CreateStudentRequest) {
    const student = await this.studentsRepository.create(input)

    return {
      student,
    }
  }
}
