import { Injectable } from '@nestjs/common'
import type { CreateExStudentRequest } from '../dtos/ex-student-requests'
import { ExStudentsRepository } from '../repositories/ex-students-repository'

@Injectable()
export class CreateExStudentUseCase {
  constructor(private readonly exStudentsRepository: ExStudentsRepository) {}

  async execute(input: CreateExStudentRequest) {
    const exStudent = await this.exStudentsRepository.create(input)
    return { exStudent }
  }
}
