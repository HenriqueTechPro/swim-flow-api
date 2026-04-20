import { ClassesRepository } from '../repositories/classes-repository';

export class DeleteClassUseCase {
  constructor(private readonly classesRepository: ClassesRepository) {}

  async execute(id: string) {
    const classItem = await this.classesRepository.remove(id);

    return {
      classItem,
    };
  }
}
