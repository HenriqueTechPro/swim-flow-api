import type { SaveAttendanceBatchRequest } from '../dtos/attendance-requests'
import type { AttendanceRecord } from '../../enterprise/entities/attendance-record'
import type { PaginatedResult, PaginationParams } from '@/domain/shared/pagination/pagination-params'

export interface ListAttendanceRepositoryParams extends PaginationParams {
  search?: string
  startDate?: string
  endDate?: string
  classId?: string
  studentId?: string
  status?: string
}

export abstract class AttendanceRepository {
  abstract list(params?: ListAttendanceRepositoryParams): Promise<PaginatedResult<AttendanceRecord>>
  abstract saveBatch(input: SaveAttendanceBatchRequest): Promise<AttendanceRecord[]>
}
