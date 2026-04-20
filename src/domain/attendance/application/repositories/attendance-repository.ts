import type { SaveAttendanceBatchRequest } from '../dtos/attendance-requests';
import type { AttendanceRecord } from '../../enterprise/entities/attendance-record';
import type {
  PaginatedResult,
  PaginationParams,
} from '@/domain/shared/pagination/pagination-params';

export interface ListAttendanceRepositoryParams extends PaginationParams {
  search?: string;
  startDate?: string;
  endDate?: string;
  classId?: string;
  studentId?: string;
  status?: string;
}

export interface AttendanceBatchContext {
  existingStudentIds: string[];
  existingClassIds: string[];
  activeStudentClassLinks: Array<{
    studentId: string;
    classId: string;
  }>;
}

export interface AttendanceSummaryParams {
  date?: string;
  startDate?: string;
  endDate?: string;
  classId?: string;
  studentId?: string;
}

export interface AttendanceClassSummary {
  classId: string;
  totalStudents: number;
  recordedStudents: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  justifiedCount: number;
  isCompleted: boolean;
  savedAt?: string;
}

export interface AttendanceStudentSummary {
  studentId: string;
  totalClasses: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  justifiedCount: number;
  attendancePercentage: number;
}

export interface AttendanceSummary {
  date?: string;
  startDate?: string;
  endDate?: string;
  totalClasses: number;
  completedClasses: number;
  pendingClasses: number;
  totalStudents: number;
  studentsWithAttendance: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  justifiedCount: number;
  attendanceRate: number;
  classes: AttendanceClassSummary[];
  students: AttendanceStudentSummary[];
  lastSavedAt?: string;
}

export abstract class AttendanceRepository {
  abstract list(
    params?: ListAttendanceRepositoryParams,
  ): Promise<PaginatedResult<AttendanceRecord>>;
  abstract summary(
    params?: AttendanceSummaryParams,
  ): Promise<AttendanceSummary>;
  abstract getBatchContext(
    input: SaveAttendanceBatchRequest,
  ): Promise<AttendanceBatchContext>;
  abstract saveBatch(
    input: SaveAttendanceBatchRequest,
  ): Promise<AttendanceRecord[]>;
}
