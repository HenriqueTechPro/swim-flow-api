import { beforeEach, describe, expect, it } from '@jest/globals'
import { ListAttendanceRecordsUseCase } from './list-attendance-records'
import { InMemoryAttendanceRepository } from '../../../../../test/repositories/in-memory-attendance-repository'
import { makeAttendanceRecord } from '../../../../../test/factories/make-attendance-record'

describe('ListAttendanceRecordsUseCase', () => {
  let attendanceRepository: InMemoryAttendanceRepository
  let sut: ListAttendanceRecordsUseCase

  beforeEach(() => {
    attendanceRepository = new InMemoryAttendanceRepository()
    sut = new ListAttendanceRecordsUseCase(attendanceRepository)
  })

  it('lists attendance records', async () => {
    attendanceRepository.items.push(makeAttendanceRecord(), makeAttendanceRecord())

    const { items, total } = await sut.execute()

    expect(items).toHaveLength(2)
    expect(total).toBe(2)
  })
})
