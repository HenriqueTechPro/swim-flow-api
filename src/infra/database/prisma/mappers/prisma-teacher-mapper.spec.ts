import { PrismaTeacherMapper, type PrismaTeacherRecord } from './prisma-teacher-mapper';

const teacher: PrismaTeacherRecord = {
  id: 'teacher-1',
  name: 'Treinadora',
  photo: null,
  cpf: null,
  speciality: 'Natação',
  experience: 8,
  phone: '',
  email: '',
  status: 'Ativo',
  birthDate: null,
  address: null,
  bio: null,
  teacherCategories: [],
  teacherCertifications: [],
  classTeachers: [
    {
      classId: 'class-2',
      role: 'assistant_coach',
      swimmingClass: { name: 'Mirim II' },
    },
    {
      classId: 'class-1',
      role: 'head_coach',
      swimmingClass: { name: 'Mirim I' },
    },
  ],
};

describe('PrismaTeacherMapper class relation summary', () => {
  it('maps class id, name and coach role without fetching the full class roster', () => {
    const mapped = PrismaTeacherMapper.toDomain(teacher, new Map([
      ['class-1', 7], ['class-2', 4],
    ]));
    expect(mapped.studentsCount).toBe(11);
    expect(mapped.assignedClasses).toEqual([
      { classId: 'class-2', name: 'Mirim II', role: 'assistant_coach' },
      { classId: 'class-1', name: 'Mirim I', role: 'head_coach' },
    ]);
  });

  it('returns an empty assignment list for teachers without classes', () => {
    const mapped = PrismaTeacherMapper.toDomain(
      { ...teacher, classTeachers: [] }, new Map(),
    );
    expect(mapped.assignedClasses).toEqual([]);
    expect(mapped.studentsCount).toBe(0);
  });
});
