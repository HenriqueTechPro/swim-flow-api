import type { SaveAttendanceBatchRequest } from '../dtos/attendance-requests';
import { AttendanceRepository } from '../repositories/attendance-repository';
import { AttendanceBatchPolicy } from '../services/attendance-batch-policy';

export class SaveAttendanceBatchUseCase {
  constructor(private readonly attendanceRepository: AttendanceRepository) {}

  async execute(input: SaveAttendanceBatchRequest) {
    if (input.records.length === 0) {
      return {
        records: [],
      };
    }

    const context = await this.attendanceRepository.getBatchContext(input);
    AttendanceBatchPolicy.assertValid(input, context);

    const records = await this.attendanceRepository.saveBatch(input);

    return {
      records,
    };
  }
}