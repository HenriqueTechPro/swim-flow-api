import { Injectable } from '@nestjs/common'
import { TeachersRepository } from '../repositories/teachers-repository'

@Injectable()
export class DeleteTeacherUseCase {
  constructor(private readonly teachersRepository: TeachersRepository) {}

  async execute(id: string) {
    const teacher = await this.teachersRepository.remove(id)

    return {
      teacher,
    }
  }
}
