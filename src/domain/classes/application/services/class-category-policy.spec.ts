import { describe, expect, it } from '@jest/globals';
import { AppError } from '@/shared/errors/app-error';
import { ClassCategoryPolicy } from './class-category-policy';

describe('ClassCategoryPolicy', () => {
  const referenceData = [
    { id: 'cat-pre-mirim', name: 'Pre_Mirim' },
    { id: 'cat-mirim-1', name: 'Mirim_1' },
    { id: 'cat-mirim-2', name: 'Mirim_2' },
  ];

  it('expands grouped categories and resolves ids', () => {
    expect(
      ClassCategoryPolicy.resolveCategoryIds(['Mirim'], referenceData),
    ).toEqual(['cat-mirim-1', 'cat-mirim-2']);
  });

  it('throws when a category is missing from the catalog', () => {
    expect(() =>
      ClassCategoryPolicy.resolveCategoryIds(['Infantil 1'], referenceData),
    ).toThrow(AppError);
  });
});