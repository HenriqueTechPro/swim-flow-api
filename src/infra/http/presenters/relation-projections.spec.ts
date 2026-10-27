import { StudentPresenter } from './student.presenter';
import { TeacherPresenter } from './teacher.presenter';
import { makeStudent } from '../../../../test/factories/make-student';
import { makeTeacher } from '../../../../test/factories/make-teacher';

describe('Paginated management relation projections', () => {
  it('provides guardian phone with the existing student DTO keys', () => {
    const student = StudentPresenter.toHTTP(
      makeStudent({
        responsible: 'Responsável Principal',
        guardianPhone: '(71) 90000-0000',
      }),
    );
    expect(student).toMatchObject({
      responsible: 'Responsável Principal',
      guardianPhone: '(71) 90000-0000',
    });
    expect(student).toHaveProperty('phone');
    expect(student).toHaveProperty('parentId');
  });

  it('provides teacher class assignments without changing student count or credentials', () => {
    const teacher = TeacherPresenter.toHTTP(
      makeTeacher({
        studentsCount: 9,
        assignedClasses: [
          { classId: 'class-1', name: 'Petiz A', role: 'head_coach' },
        ],
      }),
    );
    expect(teacher.studentsCount).toBe(9);
    expect(teacher.assignedClasses).toEqual([
      { classId: 'class-1', name: 'Petiz A', role: 'head_coach' },
    ]);
    expect(teacher).toHaveProperty('categories');
  });
});
