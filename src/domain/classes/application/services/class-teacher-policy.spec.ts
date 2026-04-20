import { describe, expect, it } from '@jest/globals';
import { ClassTeacherPolicy } from './class-teacher-policy';

describe('ClassTeacherPolicy', () => {
  it('normalizes extra head coaches to assistant coaches', () => {
    const normalized = ClassTeacherPolicy.normalizeAssignments([
      { teacherId: 'teacher-1', role: 'head_coach' as const },
      { teacherId: 'teacher-2', role: 'head_coach' as const },
    ]);

    expect(normalized).toEqual([
      { teacherId: 'teacher-1', role: 'head_coach' },
      { teacherId: 'teacher-2', role: 'assistant_coach' },
    ]);
  });

  it('promotes the next teacher when removing the head coach', () => {
    const plan = ClassTeacherPolicy.planRemoval(
      [
        { id: 'assignment-1', teacherId: 'teacher-1', role: 'head_coach' },
        { id: 'assignment-2', teacherId: 'teacher-2', role: 'assistant_coach' },
      ],
      'teacher-1',
    );

    expect(plan.promotedTeacherId).toBe('assignment-2');
  });

  it('demotes an incoming head coach if the target class already has one', () => {
    const plan = ClassTeacherPolicy.planTransfer(
      [
        { id: 'assignment-1', teacherId: 'teacher-1', role: 'head_coach' },
        { id: 'assignment-2', teacherId: 'teacher-2', role: 'assistant_coach' },
      ],
      [{ role: 'head_coach' }],
      { teacherId: 'teacher-1', role: 'head_coach' },
    );

    expect(plan.sourcePromotedTeacherId).toBe('assignment-2');
    expect(plan.targetRole).toBe('assistant_coach');
  });
});