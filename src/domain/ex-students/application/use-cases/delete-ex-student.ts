import { ExStudentsRepository } from '../repositories/ex-students-repository';

export class DeleteExStudentUseCase {
  constructor(private readonly exStudentsRepository: ExStudentsRepository) {}

  async execute(id: string) {
    const exStudent = await this.exStudentsRepository.remove(id);
    return { exStudent };
  }
}
