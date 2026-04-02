import type { AttendanceRecord } from '@/domain/attendance/enterprise/entities/attendance-record'

export interface PrismaAttendanceRecord {
  id: string
  studentId: string
  classId: string
  date: Date
  status: 'present' | 'absent' | 'late' | 'justified'
  observations: string
  savedAt: Date | null
}

export class PrismaAttendanceRecordMapper {
  static toDomain(record: PrismaAttendanceRecord): AttendanceRecord {
    return {
      id: record.id,
      studentId: record.studentId,
      classId: record.classId,
      date: record.date.toISOString().slice(0, 10),
      status: record.status,
      observations: record.observations || '',
      savedAt: record.savedAt?.toISOString(),
    }
  }
}
