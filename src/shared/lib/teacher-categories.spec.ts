import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TEACHER_CATEGORY_OPTIONS } from './categories';
import {
  compressTeacherCategoryNames,
  expandTeacherCategorySelection,
} from './teacher-categories';
import { parseCategoryValue } from '@/shared/utils/domain-formatters';

const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations',
  '20261108130000_complete_swimming_category_catalog',
  'migration.sql',
);
const migration = readFileSync(migrationPath, 'utf8');

describe('Official swimming categories for teachers', () => {
  it('expands all teacher groups to 28 categories', () => {
    const expanded = expandTeacherCategorySelection(TEACHER_CATEGORY_OPTIONS);
    const keys = expanded.map(parseCategoryValue);
    expect(new Set(keys).size).toBe(28);
    expect(keys).toContain('Junior_2');
    expect(keys).toContain('Pre_Master');
    expect(keys).toContain('Master_A');
    expect(keys).toContain('Master_O');
  });

  it('seeds missing categories without overwriting existing rows', () => {
    const requiredNames = [
      'Júnior 2',
      'Pré-Master',
      'Master A',
      'Master C',
      'Master O',
    ];
    for (const name of requiredNames) {
      expect(migration).toContain(`('${name}',`);
    }
    expect(migration).toContain('ON CONFLICT ("name") DO NOTHING');
    expect(migration.match(/^ {2}\('/gm)).toHaveLength(28);
  });

  it('compresses detailed categories into teacher groups', () => {
    const compressed = compressTeacherCategoryNames([
      'Junior 1',
      'Junior 2',
      'Pre-Master',
      'Master A',
      'Master B',
      'Master O',
    ]);
    expect(compressed).toEqual(['Junior', 'Master']);
  });
});
