import { PrismaStudentMapper, type PrismaStudentRecord } from './prisma-student-mapper';

const base: PrismaStudentRecord = {
  id: 'student-1', name: 'Aluno', photo: null, gender: 'Masculino',
  birthDate: new Date('2017-02-12'), phone: '', status: 'Ativo',
  achievements: 0, category: { name: 'Mirim_1' }, level: { name: 'Iniciante' },
  guardians: [], studentClasses: [],
};

describe('PrismaStudentMapper guardian primary projection', () => {
  it('keeps missing principal unspecified, never fabricating a parent', () => {
    const mapped = PrismaStudentMapper.toDomain(base);
    expect(mapped.parentId).toBeUndefined();
    expect(mapped.responsible).toBe('');
    expect(mapped.guardianPhone).toBeUndefined();
  });

  it('maps only the designated primary guardian despite extra adults', () => {
    const mapped = PrismaStudentMapper.toDomain({
      ...base,
      guardians: [
        { parentId: 'parent-secondary', isPrimary: false, parent: { name: 'Outro adulto', phone: '1111' } },
        { parentId: 'parent-primary', isPrimary: true, parent: { name: 'Principal', phone: '(71) 90000-0000' } },
      ],
    });
    expect(mapped.parentId).toBe('parent-primary');
    expect(mapped.responsible).toBe('Principal');
    expect(mapped.guardianPhone).toBe('(71) 90000-0000');
  });

  it('does not choose a secondary guardian as principal by accident', () => {
    const mapped = PrismaStudentMapper.toDomain({
      ...base,
      guardians: [{ parentId: 'another', isPrimary: false, parent: { name: 'Auxiliar', phone: '2222' } }],
    });
    expect(mapped.parentId).toBeUndefined();
    expect(mapped.responsible).toBe('');
  });
});
