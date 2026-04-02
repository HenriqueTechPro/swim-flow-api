import type { SaveAttendanceBatchRequest } from '@/domain/attendance/application/dtos/attendance-requests'
import { AttendanceRepository } from '@/domain/attendance/application/repositories/attendance-repository'
import type { ListAttendanceRepositoryParams } from '@/domain/attendance/application/repositories/attendance-repository'
import type { AttendanceRecord } from '@/domain/attendance/enterprise/entities/attendance-record'
import { AppError } from '@/shared/errors/app-error'
import { makeAttendanceRecord } from '../factories/make-attendance-record'

export class InMemoryAttendanceRepository implements AttendanceRepository {
  public items: AttendanceRecord[] = []
  public validStudentClassLinks = new Set<string>()
  public studentNames = new Map<string, string>()

  async list(params?: ListAttendanceRepositoryParams) {
    const page = Math.max(1, params?.page ?? 1)
    const perPage = Math.min(100, Math.max(1, params?.perPage ?? 20))
    const filtered = this.items.filter((item) => {
      const studentName = this.studentNames.get(item.studentId)?.toLowerCase() ?? ''
      const matchesSearch =
        !params?.search || studentName.includes(params.search.trim().toLowerCase())
      const matchesStartDate = !params?.startDate || item.date >= params.startDate
      const matchesEndDate = !params?.endDate || item.date <= params.endDate
      const matchesClass = !params?.classId || item.classId === params.classId
      const matchesStudent = !params?.studentId || item.studentId === params.studentId
      const matchesStatus = !params?.status || item.status === params.status

      return matchesSearch && matchesStartDate && matchesEndDate && matchesClass && matchesStudent && matchesStatus
    })
    const start = (page - 1) * perPage
    const end = start + perPage

    return {
      items: filtered.slice(start, end),
      total: filtered.length,
      page,
      perPage,
    }
  }

  async saveBatch(input: SaveAttendanceBatchRequest): Promise<AttendanceRecord[]> {
    const duplicatedKeys = new Set<string>()
    const seenKeys = new Set<string>()
    for (const record of input.records) {
      const key = `${record.studentId}:${record.classId}:${record.date}`
      if (seenKeys.has(key)) {
        duplicatedKeys.add(key)
      }
      seenKeys.add(key)
    }

    if (duplicatedKeys.size > 0) {
      throw new AppError(422, 'Duplicate attendance records found in request batch')
    }

    if (this.validStudentClassLinks.size > 0) {
      const invalidLink = input.records.find(
        (record) => !this.validStudentClassLinks.has(`${record.studentId}:${record.classId}`),
      )

      if (invalidLink) {
        throw new AppError(
          422,
          `Students without active class link: ${invalidLink.studentId}:${invalidLink.classId}`,
        )
      }
    }

    const savedRecords = input.records.map((record) => {
      const existingIndex = this.items.findIndex(
        (item) =>
          item.studentId === record.studentId &&
          item.classId === record.classId &&
          item.date === record.date,
      )

      const nextRecord = makeAttendanceRecord({
        ...(existingIndex >= 0 ? this.items[existingIndex] : {}),
        ...record,
      })

      if (existingIndex >= 0) {
        this.items[existingIndex] = nextRecord
      } else {
        this.items.push(nextRecord)
      }

      return nextRecord
    })

    return savedRecords
  }
}
