import { sortGroupedCategories } from '@/shared/lib/categories';
import { expandTeacherCategorySelection } from '@/shared/lib/teacher-categories';
import { parseCategoryValue } from '@/shared/utils/domain-formatters';
import { AppError } from '@/shared/errors/app-error';
import type { ClassCategoryReference } from '../repositories/classes-repository';

export class ClassCategoryPolicy {
  static resolveCategoryIds(
    categoryNames: string[],
    referenceData: ClassCategoryReference[],
  ) {
    const normalizedCategoryNames = sortGroupedCategories(
      expandTeacherCategorySelection(categoryNames),
    ).map(parseCategoryValue);
    const categoryIdsByName = new Map(
      referenceData.map((category) => [category.name, category.id]),
    );
    const missing = normalizedCategoryNames.filter(
      (name) => !categoryIdsByName.has(name),
    );

    if (missing.length > 0) {
      throw new AppError(422, `Categories not found: ${missing.join(', ')}`);
    }

    return normalizedCategoryNames.map(
      (name) => categoryIdsByName.get(name) as string,
    );
  }
}