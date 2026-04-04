import { z } from 'zod'

export const createPoolSchema = z.object({
  name: z.string().min(3),
  lengthMeters: z.number().int().positive(),
  address: z.string().min(1),
  status: z.enum(['Ativa', 'Inativa', 'Manutenção']),
  maxCapacity: z.number().int().positive().nullable().optional(),
})

export const updatePoolSchema = createPoolSchema

export type CreatePoolDto = z.infer<typeof createPoolSchema>
export type UpdatePoolDto = z.infer<typeof updatePoolSchema>
