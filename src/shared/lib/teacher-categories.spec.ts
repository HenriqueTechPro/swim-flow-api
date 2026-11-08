import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TEACHER_CATEGORY_OPTIONS } from './categories';
import {
  compressTeacherCategoryNames,
  expandTeacherCategorySelection,
} from './teacher-categories';
import { parseCategoryValue } from '@/shared/utils/domain-formatters';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20261108130000_complete_swimming_category_catalog/migration.sql',
  ),
  'utf8',
);

describe('Official swimming categories for teachers', () => {
  it('expands every teacher group to all 28 official categories', () => {
    const expanded = expandTeacherCategorySelection(TEACHER_CATEGORY_OPTIONS);
    const keys = expanded.map(parseCategoryValue);
    expect(new Set(keys).size).toBe(28);
    expect(keys).toContain('Junior_2');
    expect(keys).toContain('Pre_Master');
    expect(keys).toContain('Master_A');
    expect(keys).toContain('Master_O');
  });

  it('provides the missing senior and master rows in an idempotent migration', () => {
    for (const name of [
      'Júnior 2',
      'Pré-Master',
      'Master A',
      'Master C',
      'Master O',
    ]) {
      expect(migration).toContain(`('${name}',`);
    }
    expect(migration).toContain('ON CONFLICT ("name") DO NOTHING');
    expect((migration.match(/^  \('/gm) ?? [])).toHaveLength(28);
  });

  it('can compress the full expanded selection for the teacher edit form', () => {
    expect(compressTeacherCategoryNames([
      'Junior 1',
      'Junior 2',
      'Pre-Master',
      'Master A',
      'Master B',
      'Master O',
    ])).toEqual(['Junior', 'Master']);
  });
});
