import { Injectable } from '@nestjs/common'
import type { SaveAttendanceBatchRequest } from '../dtos/attendance-requests'
import { AttendanceRepository } from '../repositories/attendance-repository'

@Injectable()
export class SaveAttendanceBatchUseCase {
  constructor(private readonly attendanceRepository: AttendanceRepository) {}

  async execute(input: SaveAttendanceBatchRequest) {
    const records = await this.attendanceRepository.saveBatch(input)

    return {
      records,
    }
  }
}
