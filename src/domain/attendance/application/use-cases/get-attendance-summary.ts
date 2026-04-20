import { AttendanceRepository } from '../repositories/attendance-repository';
import type { AttendanceSummaryParams } from '../repositories/attendance-repository';

export class GetAttendanceSummaryUseCase {
  constructor(private readonly attendanceRepository: AttendanceRepository) {}

  async execute(params?: AttendanceSummaryParams) {
    return this.attendanceRepository.summary(params);
  }
}
