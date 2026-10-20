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
    // Compare the entire ISO date, rejecting impossible dates and future births.
    const dateString = input.birthDate;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(dateString)
      ? new Date(`${dateString}T00:00:00.000Z`)
      : null;
    if (!date || Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== dateString ||
        dateString > new Date().toISOString().slice(0, 10)) {
      throw new AppError(422, 'Invalid or future student birth date');
    }

    const referenceYear = referenceData.activeSeasonYear ?? new Date().getUTCFullYear();
    const birthYear = date.getUTCFullYear();
    let categoryName: string;
    try {
      categoryName = parseCategoryValue(getCategoryByBirthYear(birthYear, referenceYear));
    } catch {
      throw new AppError(422, 'Birth date does not belong to the active season');
    }

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
      seasonId: referenceData.activeSeasonId,
    };
  }
}