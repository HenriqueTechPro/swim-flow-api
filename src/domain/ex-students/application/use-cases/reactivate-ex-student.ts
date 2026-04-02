import { Injectable } from '@nestjs/common'
import { ExStudentsRepository } from '../repositories/ex-students-repository'

@Injectable()
export class ReactivateExStudentUseCase {
  constructor(private readonly exStudentsRepository: ExStudentsRepository) {}

  async execute(id: string) {
    const exStudent = await this.exStudentsRepository.reactivate(id)
    return { exStudent }
  }
}
