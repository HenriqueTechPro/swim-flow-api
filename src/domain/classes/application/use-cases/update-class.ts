import type { UpdateClassRequest } from '../dtos/class-requests';
import { ClassesRepository } from '../repositories/classes-repository';
import { ClassCategoryPolicy } from '../services/class-category-policy';

export class UpdateClassUseCase {
  constructor(private readonly classesRepository: ClassesRepository) {}

  async execute(id: string, input: UpdateClassRequest) {
    const referenceData = await this.classesRepository.listCategoryReferenceData();
    const categoryIds = ClassCategoryPolicy.resolveCategoryIds(
      input.categories,
      referenceData,
    );
    const classItem = await this.classesRepository.update(id, {
      ...input,
      categoryIds,
    });

    return {
      classItem,
    };
  }
}