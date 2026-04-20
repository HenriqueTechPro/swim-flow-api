import { AttendanceRepository } from '../repositories/attendance-repository';
import type { ListAttendanceRepositoryParams } from '../repositories/attendance-repository';

export class ListAttendanceRecordsUseCase {
  constructor(private readonly attendanceRepository: AttendanceRepository) {}

  async execute(params?: ListAttendanceRepositoryParams) {
    return this.attendanceRepository.list(params);
  }
}
