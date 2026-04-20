import { ParentsRepository } from '../repositories/parents-repository';

export class DeleteParentUseCase {
  constructor(private readonly parentsRepository: ParentsRepository) {}

  async execute(id: string) {
    const parent = await this.parentsRepository.remove(id);
    return { parent };
  }
}
