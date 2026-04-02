import { Injectable } from '@nestjs/common'
import { StudentsRepository } from '../repositories/students-repository'

@Injectable()
export class DeleteStudentUseCase {
  constructor(private readonly studentsRepository: StudentsRepository) {}

  async execute(id: string) {
    const student = await this.studentsRepository.remove(id)

    return {
      student,
    }
  }
}
