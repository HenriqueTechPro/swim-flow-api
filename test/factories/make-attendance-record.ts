import type { AttendanceRecord } from '@/domain/attendance/enterprise/entities/attendance-record'

interface MakeAttendanceRecordOverride extends Partial<AttendanceRecord> {}

export function makeAttendanceRecord(
  override: MakeAttendanceRecordOverride = {},
): AttendanceRecord {
  return {
    id: override.id ?? crypto.randomUUID(),
    studentId: override.studentId ?? crypto.randomUUID(),
    classId: override.classId ?? crypto.randomUUID(),
    date: override.date ?? '2026-03-31',
    status: override.status ?? 'present',
    observations: override.observations ?? '',
    savedAt: override.savedAt ?? '2026-03-31T21:40:00.000Z',
  }
}
