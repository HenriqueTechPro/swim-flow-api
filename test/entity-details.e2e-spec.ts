import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { StudentsRepository } from '@/domain/students/application/repositories/students-repository';
import { ClassesRepository } from '@/domain/classes/application/repositories/classes-repository';
import { TeachersRepository } from '@/domain/teachers/application/repositories/teachers-repository';
import { createAuthenticatedE2EApp } from './utils/create-e2e-app';
import { InMemoryStudentsRepository } from './repositories/in-memory-students-repository';
import { InMemoryClassesRepository } from './repositories/in-memory-classes-repository';
import { InMemoryTeachersRepository } from './repositories/in-memory-teachers-repository';
import { makeStudent } from './factories/make-student';
import { makeClassEntity } from './factories/make-class';
import { makeTeacher } from './factories/make-teacher';

const ID = '11111111-1111-4111-8111-111111111111';
const MISSING = '22222222-2222-4222-8222-222222222222';

describe('02F-05C11 GET detail routes', () => {
  let app: INestApplication<App>;
  let students: InMemoryStudentsRepository;
  let classes: InMemoryClassesRepository;
  let teachers: InMemoryTeachersRepository;

  beforeEach(async () => {
    students = new InMemoryStudentsRepository();
    classes = new InMemoryClassesRepository();
    teachers = new InMemoryTeachersRepository();
    students.items.push(makeStudent({ id: ID, name: 'Aluno individual' }));
    classes.items.push(makeClassEntity({ id: ID, name: 'Turma individual' }));
    teachers.items.push(makeTeacher({ id: ID, name: 'Professor individual' }));

    app = await createAuthenticatedE2EApp((builder) =>
      builder
        .overrideProvider(StudentsRepository).useValue(students)
        .overrideProvider(ClassesRepository).useValue(classes)
        .overrideProvider(TeachersRepository).useValue(teachers),
    );
  });

  afterEach(async () => { await app.close(); });

  for (const [path, expectedName] of [
    ['students', 'Aluno individual'],
    ['classes', 'Turma individual'],
    ['teachers', 'Professor individual'],
  ] as const) {
    it(`GET /api/${path}/:id returns one item, 404 on missing, and 400 on invalid UUID`, async () => {
      const found = await request(app.getHttpServer())
        .get(`/api/${path}/${ID}`).expect(200);
      expect(found.body.data.id).toBe(ID);
      expect(found.body.data.name).toBe(expectedName);
      expect(found.body).not.toHaveProperty('meta');

      await request(app.getHttpServer())
        .get(`/api/${path}/${MISSING}`).expect(404);
      await request(app.getHttpServer())
        .get(`/api/${path}/not-a-uuid`).expect(400);
    });
  }
});
