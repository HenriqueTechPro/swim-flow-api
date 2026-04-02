import type { SaveAttendanceBatchRequest } from '@/domain/attendance/application/dtos/attendance-requests'
import type { SaveAttendanceBatchDto } from '@/shared/contracts/management'

export class AttendanceRequestMapper {
  static toSaveBatch(body: SaveAttendanceBatchDto): SaveAttendanceBatchRequest {
    return {
      records: body.records.map((record) => ({
        studentId: record.studentId,
        classId: record.classId,
        date: record.date,
        status: record.status,
        observations: record.observations ?? '',
        savedAt: record.savedAt,
      })),
    }
  }
}
