import { z } from 'zod'

export const attendanceRecordSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  date: z.string().min(1),
  status: z.enum(['present', 'absent', 'late', 'justified']),
  observations: z.string().optional().default(''),
  savedAt: z.string().optional(),
})

export const saveAttendanceBatchSchema = z.object({
  records: z.array(attendanceRecordSchema).min(1),
})

export type SaveAttendanceBatchDto = z.infer<typeof saveAttendanceBatchSchema>
