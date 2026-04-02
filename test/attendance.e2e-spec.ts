import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { AttendanceRepository } from '@/domain/attendance/application/repositories/attendance-repository'
import { InMemoryAttendanceRepository } from './repositories/in-memory-attendance-repository'
import { createAuthenticatedE2EApp } from './utils/create-e2e-app'

describe('AttendanceController (e2e)', () => {
  let app: INestApplication<App>
  let attendanceRepository: InMemoryAttendanceRepository

  beforeEach(async () => {
    attendanceRepository = new InMemoryAttendanceRepository()
    attendanceRepository.validStudentClassLinks.add(
      '11111111-1111-1111-1111-111111111111:22222222-2222-2222-2222-222222222222',
    )
    attendanceRepository.studentNames.set('11111111-1111-1111-1111-111111111111', 'Ana Silva')
    attendanceRepository.studentNames.set('student-1', 'Bruno Costa')
    attendanceRepository.studentNames.set('student-2', 'Carla Souza')

    app = await createAuthenticatedE2EApp((builder) =>
      builder.overrideProvider(AttendanceRepository).useValue(attendanceRepository),
    )
  })

  afterEach(async () => {
    await app.close()
  })

  it('lists and saves attendance records', async () => {
    const listBefore = await request(app.getHttpServer()).get('/api/attendance').expect(200)
    expect(listBefore.body.data).toEqual([])
    expect(listBefore.body.meta.total).toBe(0)

    const saveResponse = await request(app.getHttpServer())
      .post('/api/attendance')
      .send({
        records: [
          {
            studentId: '11111111-1111-1111-1111-111111111111',
            classId: '22222222-2222-2222-2222-222222222222',
            date: '2026-03-31',
            status: 'present',
            observations: '',
            savedAt: '2026-03-31T21:40:00.000Z',
          },
        ],
      })
      .expect(201)

    expect(saveResponse.body.data).toHaveLength(1)
    expect(saveResponse.body.data[0].status).toBe('present')

    const saveUpdateResponse = await request(app.getHttpServer())
      .post('/api/attendance')
      .send({
        records: [
          {
            studentId: '11111111-1111-1111-1111-111111111111',
            classId: '22222222-2222-2222-2222-222222222222',
            date: '2026-03-31',
            status: 'late',
            observations: 'Chegou atrasado',
            savedAt: '2026-03-31T21:45:00.000Z',
          },
        ],
      })
      .expect(201)

    expect(saveUpdateResponse.body.data[0].status).toBe('late')

    const listAfter = await request(app.getHttpServer()).get('/api/attendance').expect(200)
    expect(listAfter.body.data).toHaveLength(1)
    expect(listAfter.body.data[0].status).toBe('late')
    expect(listAfter.body.meta.total).toBe(1)
  })

  it('rejects duplicate attendance records in the same batch', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/attendance')
      .send({
        records: [
          {
            studentId: '11111111-1111-1111-1111-111111111111',
            classId: '22222222-2222-2222-2222-222222222222',
            date: '2026-03-31',
            status: 'present',
            observations: '',
            savedAt: '2026-03-31T21:40:00.000Z',
          },
          {
            studentId: '11111111-1111-1111-1111-111111111111',
            classId: '22222222-2222-2222-2222-222222222222',
            date: '2026-03-31',
            status: 'late',
            observations: '',
            savedAt: '2026-03-31T21:45:00.000Z',
          },
        ],
      })
      .expect(422)

    expect(response.body.message).toContain('Duplicate attendance records')
  })

  it('rejects attendance save when student is not linked to class', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/attendance')
      .send({
        records: [
          {
            studentId: '99999999-9999-4999-8999-999999999999',
            classId: '22222222-2222-2222-2222-222222222222',
            date: '2026-03-31',
            status: 'present',
            observations: '',
            savedAt: '2026-03-31T21:40:00.000Z',
          },
        ],
      })
      .expect(422)

    expect(response.body.message).toContain('Students without active class link')
  })

  it('filters and paginates attendance records list', async () => {
    attendanceRepository.items.push(
      {
        id: 'att-1',
        studentId: 'student-1',
        classId: 'class-1',
        date: '2026-03-31',
        status: 'present',
        observations: '',
        savedAt: '2026-03-31T21:40:00.000Z',
      },
      {
        id: 'att-2',
        studentId: 'student-2',
        classId: 'class-2',
        date: '2026-04-01',
        status: 'late',
        observations: 'Atrasado',
        savedAt: '2026-04-01T21:40:00.000Z',
      },
    )

    const response = await request(app.getHttpServer())
      .get('/api/attendance?page=1&perPage=1&search=carla&startDate=2026-04-01&endDate=2026-04-01&classId=class-2&studentId=student-2&status=late')
      .expect(200)

    expect(response.body.data).toHaveLength(1)
    expect(response.body.data[0].id).toBe('att-2')
    expect(response.body.meta).toEqual({
      page: 1,
      perPage: 1,
      total: 1,
    })
  })
})
