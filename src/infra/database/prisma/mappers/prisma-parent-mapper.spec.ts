import { PrismaParentMapper, type PrismaParentRecord } from './prisma-parent-mapper';

describe('PrismaParentMapper', () => {
  it('returns all linked children without relying on a single Student.parentId', () => {
    const record: PrismaParentRecord = {
      id: 'parent-a', name: 'Responsavel', photo: null, cpf: null,
      birthDate: null, phone: '', email: '', profession: '', address: '',
      emergencyContact: '', emergencyPhone: '', status: 'Ativo',
      studentGuardians: [
        { student: { id: 'student-a', name: 'Nadador A' } },
        { student: { id: 'student-b', name: 'Nadador B' } },
      ],
    };
    expect(PrismaParentMapper.toDomain(record)).toMatchObject({
      childrenIds: ['student-a', 'student-b'],
      children: ['Nadador A', 'Nadador B'],
    });
  });
});
