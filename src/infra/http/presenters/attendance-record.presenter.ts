import type { AttendanceRecord } from '@/domain/attendance/enterprise/entities/attendance-record'

export class AttendanceRecordPresenter {
  static toHTTP(record: AttendanceRecord) {
    return {
      id: record.id,
      studentId: record.studentId,
      classId: record.classId,
      date: record.date,
      status: record.status,
      observations: record.observations ?? '',
      savedAt: record.savedAt,
    }
  }
}
