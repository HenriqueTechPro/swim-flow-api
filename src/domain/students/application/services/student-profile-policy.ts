import { getCategoryByBirthYear } from '@/shared/lib/categories';
import {
  normalizeHumanLabel,
  parseCategoryValue,
} from '@/shared/utils/domain-formatters';
import { AppError } from '@/shared/errors/app-error';
import type { CreateStudentRequest } from '../dtos/student-requests';
import type {
  CreateStudentRepositoryInput,
  StudentReferenceData,
} from '../repositories/students-repository';

export class StudentProfilePolicy {
  static resolvePersistenceInput(
    input: CreateStudentRequest,
    referenceData: StudentReferenceData,
  ): CreateStudentRepositoryInput {
    const birthYear = Number(input.birthDate.slice(0, 4));
    const categoryName = parseCategoryValue(getCategoryByBirthYear(birthYear));

    const category = referenceData.categories.find(
      (item) => item.name === categoryName,
    );
    const normalizedRequestedLevel = normalizeHumanLabel(input.level);
    const level = referenceData.levels.find(
      (item) => normalizeHumanLabel(item.name) === normalizedRequestedLevel,
    );

    if (!category) {
      throw new AppError(422, `Category "${categoryName}" not found`);
    }

    if (!level) {
      throw new AppError(422, `Level "${input.level}" not found`);
    }

    return {
      ...input,
      categoryId: category.id,
      levelId: level.id,
    };
  }
}