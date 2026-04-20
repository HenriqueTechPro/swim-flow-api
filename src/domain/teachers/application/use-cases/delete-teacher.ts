import { TeachersRepository } from '../repositories/teachers-repository';

export class DeleteTeacherUseCase {
  constructor(private readonly teachersRepository: TeachersRepository) {}

  async execute(id: string) {
    const teacher = await this.teachersRepository.remove(id);

    return {
      teacher,
    };
  }
}
