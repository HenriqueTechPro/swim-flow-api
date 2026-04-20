import type { CreateClassRequest } from '../dtos/class-requests';
import { ClassesRepository } from '../repositories/classes-repository';
import { ClassCategoryPolicy } from '../services/class-category-policy';

export class CreateClassUseCase {
  constructor(private readonly classesRepository: ClassesRepository) {}

  async execute(input: CreateClassRequest) {
    const referenceData = await this.classesRepository.listCategoryReferenceData();
    const categoryIds = ClassCategoryPolicy.resolveCategoryIds(
      input.categories,
      referenceData,
    );
    const classItem = await this.classesRepository.create({
      ...input,
      categoryIds,
    });

    return {
      classItem,
    };
  }
}