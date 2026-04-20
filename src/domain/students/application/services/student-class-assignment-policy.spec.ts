import { describe, expect, it } from '@jest/globals';
import { StudentClassAssignmentPolicy } from './student-class-assignment-policy';

describe('StudentClassAssignmentPolicy', () => {
  it('keeps the current link when the requested class is already active', () => {
    const plan = StudentClassAssignmentPolicy.plan(['class-1'], 'class-1');

    expect(plan).toEqual({
      classIdsToClose: [],
      nextClassId: 'class-1',
      shouldCreateNextClassLink: false,
    });
  });

  it('closes the old link and creates a new one when the class changes', () => {
    const plan = StudentClassAssignmentPolicy.plan(['class-1'], 'class-2');

    expect(plan).toEqual({
      classIdsToClose: ['class-1'],
      nextClassId: 'class-2',
      shouldCreateNextClassLink: true,
    });
  });

  it('closes every active link when the student is removed from classes', () => {
    const plan = StudentClassAssignmentPolicy.plan(['class-1', 'class-2'], null);

    expect(plan).toEqual({
      classIdsToClose: ['class-1', 'class-2'],
      nextClassId: null,
      shouldCreateNextClassLink: false,
    });
  });
});