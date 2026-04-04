import { z } from 'zod'

export const createParentSchema = z.object({
  name: z.string().min(3),
  cpf: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  photo: z.string().optional().nullable(),
  childrenIds: z.array(z.string().uuid()).default([]),
  email: z.string().email(),
  phone: z.string().min(1),
  profession: z.string().min(1),
  address: z.string().min(1),
  emergencyContact: z.string().min(1),
  emergencyPhone: z.string().min(1),
  status: z.enum(['Ativo', 'Inativo']),
})

export const updateParentSchema = createParentSchema.partial().extend({
  name: z.string().min(3),
  childrenIds: z.array(z.string().uuid()).default([]),
  email: z.string().email(),
  phone: z.string().min(1),
  profession: z.string().min(1),
  address: z.string().min(1),
  emergencyContact: z.string().min(1),
  emergencyPhone: z.string().min(1),
  status: z.enum(['Ativo', 'Inativo']),
})

export type CreateParentDto = z.infer<typeof createParentSchema>
export type UpdateParentDto = z.infer<typeof updateParentSchema>
