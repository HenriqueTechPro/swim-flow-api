import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { ClassesRepository } from '@/domain/classes/application/repositories/classes-repository'
import { makeClassEntity } from './factories/make-class'
import { InMemoryClassesRepository } from './repositories/in-memory-classes-repository'
import { createAuthenticatedE2EApp } from './utils/create-e2e-app'

describe('ClassesController (e2e)', () => {
  let app: INestApplication<App>
  let classesRepository: InMemoryClassesRepository

  beforeEach(async () => {
    classesRepository = new InMemoryClassesRepository()

    app = await createAuthenticatedE2EApp((builder) =>
      builder.overrideProvider(ClassesRepository).useValue(classesRepository),
    )
  })

  afterEach(async () => {
    await app.close()
  })

  it('creates, updates, manages teachers and deletes a class', async () => {
    const listBefore = await request(app.getHttpServer()).get('/api/classes').expect(200)
    expect(listBefore.body.data).toEqual([])

    const createResponse = await request(app.getHttpServer())
      .post('/api/classes')
      .send({
        name: 'Turma E2E',
        categories: ['Pre-Mirim', 'Mirim 1'],
        schedules: [
          {
            dayOfWeek: 'Segunda-feira',
            startTime: '08:00',
            endTime: '09:00',
          },
        ],
        classTeachers: [],
        maxStudents: 12,
        poolId: null,
        status: 'Ativa',
      })
      .expect(201)

    const classId = createResponse.body.data.id as string
    expect(createResponse.body.data.name).toBe('Turma E2E')

    const updateResponse = await request(app.getHttpServer())
      .put(`/api/classes/${classId}`)
      .send({
        name: 'Turma E2E Atualizada',
        categories: ['Mirim', 'Petiz'],
        schedules: [
          {
            dayOfWeek: 'Quarta-feira',
            startTime: '08:00',
            endTime: '09:00',
          },
        ],
        classTeachers: [],
        maxStudents: 14,
        poolId: null,
        status: 'Ativa',
      })
      .expect(200)

    expect(updateResponse.body.data.name).toBe('Turma E2E Atualizada')

    const teacherId = '33333333-3333-4333-8333-333333333333'

    const addTeacherResponse = await request(app.getHttpServer())
      .post(`/api/classes/${classId}/teachers`)
      .send({
        teacherId,
        role: 'head_coach',
      })
      .expect(201)

    expect(addTeacherResponse.body.data.classTeachers).toHaveLength(1)
    expect(addTeacherResponse.body.data.classTeachers[0].teacherId).toBe(teacherId)

    const updateRoleResponse = await request(app.getHttpServer())
      .patch(`/api/classes/${classId}/teachers/${teacherId}/role`)
      .send({
        role: 'assistant_coach',
      })
      .expect(200)

    expect(updateRoleResponse.body.data.classTeachers[0].role).toBe('assistant_coach')

    const removeTeacherResponse = await request(app.getHttpServer())
      .delete(`/api/classes/${classId}/teachers/${teacherId}`)
      .expect(200)

    expect(removeTeacherResponse.body.data.classTeachers).toHaveLength(0)

    const deleteResponse = await request(app.getHttpServer())
      .delete(`/api/classes/${classId}`)
      .expect(200)

    expect(deleteResponse.body.data.id).toBe(classId)
  })

  it('transfers a student between classes', async () => {
    const sourceClass = makeClassEntity({
      id: '44444444-4444-4444-8444-444444444444',
      students: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          name: 'Aluno E2E',
          age: 12,
          category: 'Petiz 2',
          level: 'Iniciante',
          status: 'Ativo',
        },
      ],
      enrolledStudents: 1,
    })

    const targetClass = makeClassEntity({
      id: '66666666-6666-4666-8666-666666666666',
      students: [],
      enrolledStudents: 0,
    })

    classesRepository.items.push(sourceClass, targetClass)

    const transferResponse = await request(app.getHttpServer())
      .post('/api/classes/students/transfer')
      .send({
        studentId: '55555555-5555-4555-8555-555555555555',
        fromClassId: sourceClass.id,
        toClassId: targetClass.id,
      })
      .expect(201)

    expect(transferResponse.body.data.id).toBe(targetClass.id)
    expect(transferResponse.body.data.students).toHaveLength(1)
    expect(transferResponse.body.data.students[0].id).toBe('55555555-5555-4555-8555-555555555555')
  })

  it('filters and paginates classes list', async () => {
    classesRepository.items.push(
      makeClassEntity({
        name: 'Turma Mirim Manha',
        categories: ['Mirim 1'],
        category: 'Mirim 1',
        schedules: [{ id: crypto.randomUUID(), dayOfWeek: 'Segunda-feira', startTime: '08:00', endTime: '09:00' }],
        dayOfWeek: 'Segunda-feira',
        status: 'Ativa',
        poolId: 'pool-a',
        pool: 'Piscina A',
        teachers: ['Ana Clara'],
        classTeachers: [
          {
            id: crypto.randomUUID(),
            teacherId: crypto.randomUUID(),
            teacherName: 'Ana Clara',
            role: 'head_coach',
          },
        ],
      }),
      makeClassEntity({
        name: 'Turma Petiz Tarde',
        categories: ['Petiz 2'],
        category: 'Petiz 2',
        schedules: [{ id: crypto.randomUUID(), dayOfWeek: 'Quarta-feira', startTime: '14:00', endTime: '15:00' }],
        dayOfWeek: 'Quarta-feira',
        status: 'Pausada',
        poolId: 'pool-b',
        pool: 'Piscina B',
        teachers: ['Carlos'],
        classTeachers: [
          {
            id: crypto.randomUUID(),
            teacherId: crypto.randomUUID(),
            teacherName: 'Carlos',
            role: 'head_coach',
          },
        ],
      }),
    )

    const response = await request(app.getHttpServer())
      .get('/api/classes?page=1&perPage=1&search=ana&category=Mirim%201&day=Segunda-feira&status=Ativa&poolId=pool-a')
      .expect(200)

    expect(response.body.data).toHaveLength(1)
    expect(response.body.data[0].name).toBe('Turma Mirim Manha')
    expect(response.body.meta.total).toBe(1)
  })
})
