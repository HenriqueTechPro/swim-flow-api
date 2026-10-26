import { describe, expect, it } from '@jest/globals';
import {
  createParentSchema,
  createTeacherSchema,
  updateParentSchema,
  updateTeacherSchema,
} from './management';

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

describe('CPF validation on NestJS create and update DTOs', () => {
  it('keeps CPF optional and accepts valid formatted or numeric forms', () => {
    for (const cpf of [undefined, null, '', '52998224725', '529.982.247-25']) {
      for (const schema of [createTeacherSchema, updateTeacherSchema]) {
        expect(schema.safeParse({ ...teacher, cpf }).success).toBe(true);
      }
      for (const schema of [createParentSchema, updateParentSchema]) {
        expect(schema.safeParse({ ...parent, cpf }).success).toBe(true);
      }
    }
  });

  it('rejects bad check digits, repeated and malformed values for create and update', () => {
    for (const cpf of [
      '529.982.247-26', '52998224726', '000.000.000-00',
      '12345678901', '52998224725x', '529.982.247',
    ]) {
      for (const schema of [createTeacherSchema, updateTeacherSchema]) {
        const result = schema.safeParse({ ...teacher, cpf });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some((issue) => issue.path[0] === 'cpf')).toBe(true);
        }
      }
      for (const schema of [createParentSchema, updateParentSchema]) {
        const result = schema.safeParse({ ...parent, cpf });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some((issue) => issue.path[0] === 'cpf')).toBe(true);
        }
      }
    }
  });
});
