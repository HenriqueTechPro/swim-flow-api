#!/usr/bin/env node
'use strict';

// Runs REAL overlapping Prisma operations on a disposable PostgreSQL 16 CI
// database. All test identities are fictional. This file never runs in prod.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const urls = [process.env.DATABASE_URL, process.env.DIRECT_URL];
if (process.env.SWIMFLOW_DISPOSABLE_DB !== 'yes' || !urls.every((value) => {
  try {
    const parsed = new URL(value);
    return ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname) &&
      parsed.pathname === '/swimflow';
  } catch {
    return false;
  }
})) {
  throw new Error('REFUSING to run outside disposable LOCAL swimflow Postgres');
}
require('ts-node/register/transpile-only');
require('tsconfig-paths/register');
const { PrismaClient } = require('@prisma/client');
const { PrismaStudentsRepository } = require('../src/infra/database/prisma/repositories/prisma-students-repository');
const { PrismaExStudentsRepository } = require('../src/infra/database/prisma/repositories/prisma-ex-students-repository');

const prisma = new PrismaClient();
const cache = {
  get: async () => null,
  set: async () => {},
  deleteMatching: async () => {},
};
const env = { cacheTtlSeconds: 0 };
const students = new PrismaStudentsRepository(prisma, cache, env);
const departures = new PrismaExStudentsRepository(prisma, cache, env);

function isUnique(error) {
  return error && error.code === 'P2002';
}
function isGuardedConflict(error) {
  return error && (
    ['P2002', 'P2034'].includes(error.code) ||
    error.statusCode === 409 ||
    error.status === 409
  );
}
function exactlyOne(operations, isExpectedFailure, description) {
  return Promise.allSettled(operations).then((outcomes) => {
    const winners = outcomes.filter((item) => item.status === 'fulfilled');
    const failures = outcomes.filter((item) => item.status === 'rejected');
    assert.equal(winners.length, 1, description + ': exactly one operation must commit');
    assert.equal(failures.length, 1, description + ': exactly one operation must fail');
    assert.ok(isExpectedFailure(failures[0].reason),
      description + ': unexpected failure ' + String(failures[0].reason));
    return winners[0].value;
  });
}
async function createStudent(categoryId, levelId) {
  return prisma.student.create({
    data: {
      name: 'Concurrent CI Student ' + randomUUID().slice(0, 8),
      categoryId,
      levelId,
      birthDate: new Date('2017-05-01T00:00:00Z'),
      status: 'Ativo',
    },
  });
}

async function run() {
  const category = await prisma.category.findFirstOrThrow();
  const level = await prisma.level.findFirstOrThrow();

  // 1. Competing season transitions: exactly one global ACTIVE season.
  // The previous migration verification installed a fictitious ACTIVE season.
  await prisma.season.updateMany({
    where: { status: 'ACTIVE' }, data: { status: 'CLOSED' },
  });
  const [seasonA, seasonB] = await Promise.all([
    prisma.season.create({ data: {
      year: 2081, label: 'Concurrency A',
      startsOn: new Date('2081-01-01'), endsOn: new Date('2081-12-31'),
    } }),
    prisma.season.create({ data: {
      year: 2082, label: 'Concurrency B',
      startsOn: new Date('2082-01-01'), endsOn: new Date('2082-12-31'),
    } }),
  ]);
  await exactlyOne([
    prisma.season.update({ where: { id: seasonA.id }, data: { status: 'ACTIVE' } }),
    prisma.season.update({ where: { id: seasonB.id }, data: { status: 'ACTIVE' } }),
  ], isUnique, 'two active seasons');
  assert.equal(await prisma.season.count({ where: { status: 'ACTIVE' } }), 1);

  // 2. Two distinct adults both try to become the same child's main guardian.
  // At most one principal must survive the race.
  const guardianStudent = await createStudent(category.id, level.id);
  const [adultA, adultB] = await Promise.all([
    prisma.parent.create({ data: { name: 'CI Adult A' } }),
    prisma.parent.create({ data: { name: 'CI Adult B' } }),
  ]);
  const selected = await exactlyOne([
    prisma.studentGuardian.create({ data: {
      studentId: guardianStudent.id, parentId: adultA.id, isPrimary: true,
    } }),
    prisma.studentGuardian.create({ data: {
      studentId: guardianStudent.id, parentId: adultB.id, isPrimary: true,
    } }),
  ], isUnique, 'two main guardians');
  assert.equal(await prisma.studentGuardian.count({
    where: { studentId: guardianStudent.id, isPrimary: true },
  }), 1);
  const secondary = selected.parentId === adultA.id ? adultB.id : adultA.id;
  await prisma.studentGuardian.create({ data: {
    studentId: guardianStudent.id, parentId: secondary, isPrimary: false,
  } });
  assert.equal(await prisma.studentGuardian.count({
    where: { studentId: guardianStudent.id },
  }), 2);

  // 3. Concurrent enrolments to different classes, both marked primary.
  const enrollmentStudent = await createStudent(category.id, level.id);
  const [classA, classB] = await Promise.all([
    prisma.swimmingClass.create({ data: { name: 'Concurrency class A', categoryId: category.id } }),
    prisma.swimmingClass.create({ data: { name: 'Concurrency class B', categoryId: category.id } }),
  ]);
  const enrolled = await exactlyOne([
    prisma.studentClass.create({ data: {
      studentId: enrollmentStudent.id, classId: classA.id, isPrimary: true,
    } }),
    prisma.studentClass.create({ data: {
      studentId: enrollmentStudent.id, classId: classB.id, isPrimary: true,
    } }),
  ], isUnique, 'two primary enrolments');
  assert.equal(await prisma.studentClass.count({
    where: { studentId: enrollmentStudent.id, isPrimary: true, toDate: null },
  }), 1);
  await exactlyOne([
    prisma.studentClass.create({ data: {
      studentId: enrollmentStudent.id, classId: classA.id, isPrimary: false,
    } }),
    prisma.studentClass.create({ data: {
      studentId: enrollmentStudent.id, classId: classA.id, isPrimary: false,
    } }),
  ].map((operation) => operation), isUnique, 'same student/class pair duplicate')
    .catch(async (err) => {
      // If class A was already the primary, both attempts should fail because
      // an active pair already exists. Verify that instead.
      if (enrolled.classId !== classA.id) throw err;
      const count = await prisma.studentClass.count({
        where: { studentId: enrollmentStudent.id, classId: classA.id, toDate: null },
      });
      assert.equal(count, 1);
    });

  // 4. A transaction that demotes a current guardian must fully roll back
  // if its replacement references a missing adult. No partial transfer.
  const rollbackStudent = await createStudent(category.id, level.id);
  await prisma.studentGuardian.create({ data: {
    studentId: rollbackStudent.id, parentId: adultA.id, isPrimary: true,
  } });
  await prisma.studentClass.create({ data: {
    studentId: rollbackStudent.id, classId: classA.id, isPrimary: true,
  } });
  const previousName = rollbackStudent.name;
  const badParentId = randomUUID();
  await assert.rejects(
    () => students.update(rollbackStudent.id, {
      name: 'SHOULD ROLL BACK', gender: 'Masculino',
      birthDate: '2017-05-01', status: 'Ativo', level: 'Iniciante',
      categoryId: category.id, levelId: level.id, phone: '',
      parentId: badParentId, classId: classB.id,
    }),
    (error) => Boolean(error && ['P2003', 'P2014'].includes(error.code)),
    'FK violation must abort student/guardian/enrollment transaction',
  );
  const afterRollback = await prisma.student.findUniqueOrThrow({
    where: { id: rollbackStudent.id },
    include: {
      guardians: true,
      studentClasses: { where: { toDate: null } },
    },
  });
  assert.equal(afterRollback.name, previousName);
  assert.equal(afterRollback.guardians.length, 1);
  assert.equal(afterRollback.guardians[0].parentId, adultA.id);
  assert.equal(afterRollback.guardians[0].isPrimary, true);
  assert.equal(afterRollback.studentClasses.length, 1);
  assert.equal(afterRollback.studentClasses[0].classId, classA.id);

  // 5. Actual repository: two simultaneous archive requests must never
  // produce two current departure records or inconsistent student status.
  const departureStudent = await createStudent(category.id, level.id);
  const departureInput = {
    studentId: departureStudent.id,
    exitDate: '2026-10-19',
    exitReason: 'Falta de tempo',
  };
  const departure = await exactlyOne([
    departures.create(departureInput),
    departures.create(departureInput),
  ], isGuardedConflict, 'simultaneous departures');
  assert.equal(await prisma.exStudent.count({
    where: { studentId: departureStudent.id, reactivatedAt: null, voidedAt: null },
  }), 1);
  assert.equal((await prisma.student.findUniqueOrThrow({
    where: { id: departureStudent.id }, select: { status: true },
  })).status, 'Inativo');

  // 6. Reinstatement and voiding race for the SAME departure: only one
  // terminal outcome, never both timestamps, student must be active.
  await exactlyOne([
    departures.reactivate(departure.id),
    departures.remove(departure.id),
  ], isGuardedConflict, 'reactivate against void');
  const closed = await prisma.exStudent.findUniqueOrThrow({
    where: { id: departure.id },
  });
  assert.equal(Number(closed.reactivatedAt !== null) +
    Number(closed.voidedAt !== null), 1);
  assert.equal((await prisma.student.findUniqueOrThrow({
    where: { id: departureStudent.id }, select: { status: true },
  })).status, 'Ativo');
  assert.equal(await prisma.exStudent.count({
    where: { studentId: departureStudent.id, reactivatedAt: null, voidedAt: null },
  }), 0);

  // 7. Two score writers targeting the same template/criterion must not
  // create a duplicate score row.
  const template = await prisma.technicalAssessmentTemplate.create({
    data: { name: 'Concurrency template ' + randomUUID(), version: 1 },
  });
  const criterion = await prisma.technicalAssessmentCriterion.create({
    data: { templateId: template.id, code: 'STREAMLINE', name: 'Body position' },
  });
  const assessment = await prisma.studentTechnicalAssessment.create({
    data: {
      studentId: guardianStudent.id, templateId: template.id,
      assessedOn: new Date('2026-10-19'),
    },
  });
  await exactlyOne([
    prisma.technicalAssessmentScore.create({ data: {
      assessmentId: assessment.id, templateId: template.id,
      criterionId: criterion.id, score: '4',
    } }),
    prisma.technicalAssessmentScore.create({ data: {
      assessmentId: assessment.id, templateId: template.id,
      criterionId: criterion.id, score: '5',
    } }),
  ], isUnique, 'double technical score');
  assert.equal(await prisma.technicalAssessmentScore.count({
    where: { assessmentId: assessment.id, criterionId: criterion.id },
  }), 1);

  console.log('PASS: seven real PostgreSQL concurrency / atomicity scenarios.');
}

run().then(
  async () => { await prisma.$disconnect(); },
  async (error) => { console.error(error); await prisma.$disconnect(); process.exitCode = 1; },
);
