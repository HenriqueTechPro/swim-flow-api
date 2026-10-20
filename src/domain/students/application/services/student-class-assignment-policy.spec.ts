import { describe, expect, it } from '@jest/globals';
import { StudentClassAssignmentPolicy } from './student-class-assignment-policy';

describe('StudentClassAssignmentPolicy', () => {
  it('keeps and promotes the current link when the requested class is already active', () => {
    const plan = StudentClassAssignmentPolicy.plan(['class-1'], 'class-1');

    expect(plan).toEqual({
      classIdsToClose: [],
      nextClassId: 'class-1',
      shouldCreateNextClassLink: false,
      shouldPromoteExistingLink: true,
    });
  });

  it('closes the old link and creates a new one when the class changes', () => {
    const plan = StudentClassAssignmentPolicy.plan(['class-1'], 'class-2');

    expect(plan).toEqual({
      classIdsToClose: ['class-1'],
      nextClassId: 'class-2',
      shouldCreateNextClassLink: true,
      shouldPromoteExistingLink: false,
    });
  });

  it('closes every active link when the student is removed from classes', () => {
    const plan = StudentClassAssignmentPolicy.plan(['class-1', 'class-2'], null);

    expect(plan).toEqual({
      classIdsToClose: ['class-1', 'class-2'],
      nextClassId: null,
      shouldCreateNextClassLink: false,
      shouldPromoteExistingLink: false,
    });
  });

  it('promotes an already-linked secondary class rather than duplicating enrollment', () => {
    const plan = StudentClassAssignmentPolicy.plan(['class-1', 'class-2'], 'class-2');

    expect(plan).toEqual({
      classIdsToClose: ['class-1'],
      nextClassId: 'class-2',
      shouldCreateNextClassLink: false,
      shouldPromoteExistingLink: true,
    });
  });
});
