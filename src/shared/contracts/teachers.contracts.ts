import { z } from 'zod'

export const createTeacherSchema = z.object({
  name: z.string().min(3),
  cpf: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  email: z.string().email(),
  phone: z.string().min(1),
  photo: z.string().optional().nullable(),
  specialities: z.array(z.string().min(1)).min(1),
  categories: z.array(z.string().min(1)).min(1),
  experience: z.string().min(1),
  certifications: z.string().optional().default(''),
  status: z.string().min(1),
  bio: z.string().optional().nullable(),
})

export const updateTeacherSchema = createTeacherSchema.partial().extend({
  name: z.string().min(3),
  email: z.string().email(),
  phone: z.string().min(1),
  specialities: z.array(z.string().min(1)).min(1),
  categories: z.array(z.string().min(1)).min(1),
  experience: z.string().min(1),
  status: z.string().min(1),
})

export type CreateTeacherDto = z.infer<typeof createTeacherSchema>
export type UpdateTeacherDto = z.infer<typeof updateTeacherSchema>
