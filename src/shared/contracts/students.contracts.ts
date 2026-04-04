import { z } from 'zod'

export const createStudentSchema = z.object({
  name: z.string().min(3),
  gender: z.enum(['Masculino', 'Feminino', 'Outro']),
  birthDate: z.string().min(1),
  level: z.string().min(1),
  parentId: z.string().uuid().optional().nullable(),
  classId: z.string().uuid().optional().nullable(),
  phone: z.string().min(1),
  status: z.string().min(1),
  photo: z.string().optional().nullable(),
})

export const updateStudentSchema = createStudentSchema.partial().extend({
  name: z.string().min(3),
  gender: z.enum(['Masculino', 'Feminino', 'Outro']),
  birthDate: z.string().min(1),
  level: z.string().min(1),
  phone: z.string().min(1),
  status: z.string().min(1),
})

export type CreateStudentDto = z.infer<typeof createStudentSchema>
export type UpdateStudentDto = z.infer<typeof updateStudentSchema>
