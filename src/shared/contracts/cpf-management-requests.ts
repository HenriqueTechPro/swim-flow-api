import { z } from 'zod';
import {
  createParentSchema,
  createTeacherSchema,
  updateParentSchema,
  updateTeacherSchema,
} from './management';
import { isValidCpf } from '@/shared/utils/cpf';

/**
 * Narrower schemas at the HTTP boundary. The legacy management contracts
 * remain unchanged, so this rollout cannot alter unrelated domain code.
 */
const cpfField = z
  .string()
  .optional()
  .nullable()
  .refine((value) => !value || isValidCpf(value), 'Invalid CPF');

export const createParentRequestSchema = createParentSchema.extend({
  cpf: cpfField,
});
export const updateParentRequestSchema = updateParentSchema.extend({
  cpf: cpfField,
});
export const createTeacherRequestSchema = createTeacherSchema.extend({
  cpf: cpfField,
});
export const updateTeacherRequestSchema = updateTeacherSchema.extend({
  cpf: cpfField,
});
