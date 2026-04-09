import { z } from 'zod'

export const classDayOfWeekSchema = z.enum([
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
  'Domingo',
])

export const classScheduleSchema = z.object({
  dayOfWeek: classDayOfWeekSchema,
  startTime: z.string().min(1),
  endTime: z.string().min(1),
})

export const classTeacherSchema = z.object({
  teacherId: z.string().uuid(),
  role: z.enum(['head_coach', 'assistant_coach']),
})

export const createClassSchema = z.object({
  name: z.string().min(3),
  categories: z.array(z.string().min(1)).min(1),
  schedules: z.array(classScheduleSchema).min(1),
  classTeachers: z.array(classTeacherSchema).default([]),
  maxStudents: z.number().int().min(1),
  poolId: z.string().uuid().nullable().optional(),
  status: z.enum(['Ativa', 'Pausada', 'Encerrada']),
})

export const updateClassSchema = createClassSchema.extend({
  categoryIds: z.array(z.string().uuid()).optional(),
})

export const transferTeacherSchema = z.object({
  teacherId: z.string().uuid(),
  fromClassId: z.string().uuid(),
  toClassId: z.string().uuid(),
})

export const transferStudentSchema = z.object({
  studentId: z.string().uuid(),
  fromClassId: z.string().uuid(),
  toClassId: z.string().uuid(),
})

export const assignClassTeacherSchema = z.object({
  teacherId: z.string().uuid(),
  role: z.enum(['head_coach', 'assistant_coach']).optional().default('assistant_coach'),
})

export const updateClassTeacherRoleSchema = z.object({
  role: z.enum(['head_coach', 'assistant_coach']),
})

export type CreateClassDto = z.infer<typeof createClassSchema>
export type UpdateClassDto = z.infer<typeof updateClassSchema>
export type TransferTeacherDto = z.infer<typeof transferTeacherSchema>
export type TransferStudentDto = z.infer<typeof transferStudentSchema>
export type AssignClassTeacherDto = z.infer<typeof assignClassTeacherSchema>
export type UpdateClassTeacherRoleDto = z.infer<typeof updateClassTeacherRoleSchema>
