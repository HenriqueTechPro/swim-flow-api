import { describe, expect, it } from '@jest/globals';
import {
  createParentRequestSchema,
  createTeacherRequestSchema,
  updateParentRequestSchema,
  updateTeacherRequestSchema,
} from './cpf-management-requests';

const teacher = {
  name: 'Professor Teste',
  email: 'professor@example.com',
  phone: '(71) 99999-9999',
  specialities: ['Livre'],
  categories: ['Master'],
  experience: '0',
  status: 'Ativo',
};

const parent = {
  name: 'Responsavel Teste',
  email: 'responsavel@example.com',
  phone: '(71) 99999-9999',
  childrenIds: [],
  profession: 'Educador',
  address: 'Rua Exemplo',
  emergencyContact: 'Contato Exemplo',
  emergencyPhone: '(71) 99999-9999',
  status: 'Ativo',
};

const checkCpfAcrossRequests = (cpf?: string | null): boolean[] => [
  createTeacherRequestSchema.safeParse({ ...teacher, cpf }).success,
  updateTeacherRequestSchema.safeParse({ ...teacher, cpf }).success,
  createParentRequestSchema.safeParse({ ...parent, cpf }).success,
  updateParentRequestSchema.safeParse({ ...parent, cpf }).success,
];

describe('CPF validation on NestJS create and update DTOs', () => {
  it('accepts an omitted, empty or valid CPF', () => {
    const valid = [true, true, true, true];

    expect(checkCpfAcrossRequests(undefined)).toEqual(valid);
    expect(checkCpfAcrossRequests(null)).toEqual(valid);
    expect(checkCpfAcrossRequests('')).toEqual(valid);
    expect(checkCpfAcrossRequests('52998224725')).toEqual(valid);
    expect(checkCpfAcrossRequests('529.982.247-25')).toEqual(valid);
  });

  it('rejects invalid CPFs for create and update', () => {
    const invalid = [false, false, false, false];

    expect(checkCpfAcrossRequests('529.982.247-26')).toEqual(invalid);
    expect(checkCpfAcrossRequests('52998224726')).toEqual(invalid);
    expect(checkCpfAcrossRequests('000.000.000-00')).toEqual(invalid);
    expect(checkCpfAcrossRequests('12345678901')).toEqual(invalid);
    expect(checkCpfAcrossRequests('52998224725x')).toEqual(invalid);
    expect(checkCpfAcrossRequests('529.982.247')).toEqual(invalid);
  });
});
