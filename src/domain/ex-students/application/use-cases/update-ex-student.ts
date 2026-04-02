import { Injectable } from '@nestjs/common'
import type { UpdateExStudentRequest } from '../dtos/ex-student-requests'
import { ExStudentsRepository } from '../repositories/ex-students-repository'

@Injectable()
export class UpdateExStudentUseCase {
  constructor(private readonly exStudentsRepository: ExStudentsRepository) {}

  async execute(id: string, input: UpdateExStudentRequest) {
    const exStudent = await this.exStudentsRepository.update(id, input)
    return { exStudent }
  }
}
