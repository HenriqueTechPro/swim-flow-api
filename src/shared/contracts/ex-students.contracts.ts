import { z } from 'zod'

export const createExStudentSchema = z.object({
  studentId: z.string().uuid(),
  exitDate: z.string().min(1),
  exitReason: z.string().min(1),
  exitNotes: z.string().optional(),
  lastCompetition: z.string().optional(),
})

export const updateExStudentSchema = z.object({
  exitDate: z.string().min(1),
  exitReason: z.string().min(1),
  exitNotes: z.string().optional(),
  achievements: z.number().int().min(0),
  lastCompetition: z.string(),
})

export const reactivateExStudentSchema = z.object({
  id: z.string().uuid(),
})

export type CreateExStudentDto = z.infer<typeof createExStudentSchema>
export type UpdateExStudentDto = z.infer<typeof updateExStudentSchema>
export type ReactivateExStudentDto = z.infer<typeof reactivateExStudentSchema>
