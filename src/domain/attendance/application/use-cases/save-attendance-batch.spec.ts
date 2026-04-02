import { beforeEach, describe, expect, it } from '@jest/globals'
import { SaveAttendanceBatchUseCase } from './save-attendance-batch'
import { InMemoryAttendanceRepository } from '../../../../../test/repositories/in-memory-attendance-repository'

describe('SaveAttendanceBatchUseCase', () => {
  let attendanceRepository: InMemoryAttendanceRepository
  let sut: SaveAttendanceBatchUseCase

  beforeEach(() => {
    attendanceRepository = new InMemoryAttendanceRepository()
    sut = new SaveAttendanceBatchUseCase(attendanceRepository)
  })

  it('saves a batch of attendance records', async () => {
    const { records } = await sut.execute({
      records: [
        {
          studentId: 'student-1',
          classId: 'class-1',
          date: '2026-03-31',
          status: 'present',
          observations: '',
          savedAt: '2026-03-31T21:40:00.000Z',
        },
      ],
    })

    expect(records).toHaveLength(1)
    expect(attendanceRepository.items).toHaveLength(1)
  })

  it('updates existing attendance record with same student, class and date', async () => {
    await sut.execute({
      records: [
        {
          studentId: 'student-1',
          classId: 'class-1',
          date: '2026-03-31',
          status: 'present',
          observations: '',
          savedAt: '2026-03-31T21:40:00.000Z',
        },
      ],
    })

    const { records } = await sut.execute({
      records: [
        {
          studentId: 'student-1',
          classId: 'class-1',
          date: '2026-03-31',
          status: 'late',
          observations: 'Chegou apos o inicio',
          savedAt: '2026-03-31T21:45:00.000Z',
        },
      ],
    })

    expect(attendanceRepository.items).toHaveLength(1)
    expect(records[0].status).toBe('late')
  })
})
