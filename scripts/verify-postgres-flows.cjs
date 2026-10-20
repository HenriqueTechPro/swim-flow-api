#!/usr/bin/env node
'use strict';
// REAL integration smoke, never production. Run only in CI disposable DB.
// Uses actual Prisma, the real student repository and PostgreSQL constraints.
require('ts-node/register/transpile-only');
require('tsconfig-paths/register');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { PrismaStudentsRepository } = require('../src/infra/database/prisma/repositories/prisma-students-repository');

const url = process.env.DATABASE_URL || '';
if (process.env.SWIMFLOW_DISPOSABLE_DB !== 'yes' ||
    !/localhost|127\.0\.0\.1/.test(url) ||
    !url.includes('/swimflow')) {
  throw new Error('Refusing to run without SWIMFLOW_DISPOSABLE_DB=yes and local swimflow DATABASE_URL');
}
const db = new PrismaClient();
const cache = { deleteMatching: async () => {}, get: async () => null, set: async () => {} };
const students = new PrismaStudentsRepository(db, cache, { cacheTtlSeconds: 0 });

async function rejectsConstraint(action, context) {
  await assert.rejects(action, (error) => {
    if (!error) return false;
    return true;
  }, context);
}

async function run() {
  // The baseline quality gate independently verifies migration SQL. These
  // scenarios exercise actual inserts and application repository behavior.
  const category = await db.category.create({ data: { name: 'Mirim_1' } });
  const level = await db.level.create({ data: { name: 'Iniciante' } });
  const season = await db.season.create({
    data: { year: 2026, label: 'CI 2026', startsOn: new Date('2026-01-01'), endsOn: new Date('2026-12-31'), status: 'ACTIVE' },
  });
  const pool = await db.pool.create({ data: { name: 'Piscina CI', lengthMeters: 25 } });
  const classA = await db.swimmingClass.create({ data: { name: 'Turma A', categoryId: category.id, poolId: pool.id } });
  const classB = await db.swimmingClass.create({ data: { name: 'Turma B', categoryId: category.id, poolId: pool.id } });
  const parent = await db.parent.create({ data: { name: 'Responsável CI' } });

  const input = {
    name: 'Aluno fictício de integração', gender: 'Masculino',
    birthDate: '2017-04-12', level: 'Iniciante', phone: '',
    status: 'Ativo', categoryId: category.id, levelId: level.id,
    seasonId: season.id, parentId: parent.id, classId: classA.id,
  };
  const student = await students.create(input);
  const studentId = student.id;
  const actual = await db.student.findUniqueOrThrow({
    where: { id: studentId }, include: {
      guardians: true, seasonCategories: true, studentClasses: true,
    },
  });
  assert.equal(actual.guardians.length, 1);
  assert.equal(actual.guardians[0].isPrimary, true);
  assert.equal(actual.seasonCategories.length, 1);
  assert.equal(actual.studentClasses.length, 1);

  // Transfer must close the old enrollment, preserving history.
  await students.update(studentId, { ...input, classId: classB.id });
  const enrollments = await db.studentClass.findMany({ where: { studentId } });
  assert.equal(enrollments.length, 2);
  assert.equal(enrollments.filter((e) => e.toDate === null && e.isPrimary).length, 1);
  assert.equal(enrollments.find((e) => e.classId === classA.id).isPrimary, false);

  await rejectsConstraint(
    () => db.studentClass.create({
      data: { studentId, classId: classB.id, isPrimary: true },
    }),
    'duplicate active enrollment',
  );

  // Nullable anthropometric values remain NULL, not fake zeros.
  const measure = await db.anthropometricAssessment.create({
    data: { studentId, measuredOn: new Date('2026-10-20'), heightCm: '142.50', armSpanCm: '149.25' },
  });
  assert.equal(measure.bodyMassKg, null);
  assert.equal(measure.footLengthCm, null);
  assert.equal(measure.heightCm.toString(), '142.5');
  await rejectsConstraint(
    () => db.anthropometricAssessment.create({
      data: { studentId, measuredOn: new Date('2026-10-20'), heightCm: '-1.00' },
    }),
    'negative anthropometry',
  );

  const template = await db.technicalAssessmentTemplate.create({ data: { name: 'Avaliação CI', version: 1 } });
  const criterion = await db.technicalAssessmentCriterion.create({
    data: { templateId: template.id, code: 'BODY_POSITION', name: 'Alinhamento', maxScore: 5 },
  });
  const assessment = await db.studentTechnicalAssessment.create({
    data: { studentId, templateId: template.id, assessedOn: new Date('2026-10-20') },
  });
  await db.technicalAssessmentScore.create({
    data: { assessmentId: assessment.id, templateId: template.id, criterionId: criterion.id, score: '4.25' },
  });
  const otherTemplate = await db.technicalAssessmentTemplate.create({ data: { name: 'Outro modelo CI' } });
  const foreignCriterion = await db.technicalAssessmentCriterion.create({
    data: { templateId: otherTemplate.id, code: 'KICK', name: 'Pernada' },
  });
  await rejectsConstraint(
    () => db.technicalAssessmentScore.create({
      data: { assessmentId: assessment.id, templateId: template.id, criterionId: foreignCriterion.id, score: '2' },
    }),
    'criterion from another assessment template',
  );

  // Pool and open water are distinct typed tables, with independent metrics.
  const poolResult = await db.poolResult.create({
    data: {
      studentId, seasonId: season.id, heldOn: new Date('2026-10-20'),
      distanceMeters: 100, poolLengthMeters: 25, style: 'FREE',
      status: 'CLASSIFIED', durationMs: 82100,
    },
  });
  const waterResult = await db.openWaterResult.create({
    data: {
      studentId, seasonId: season.id, heldOn: new Date('2026-10-20'),
      distanceMeters: 1500, status: 'CLASSIFIED', durationMs: 1740000,
    },
  });
  assert.equal((await db.poolResult.findUniqueOrThrow({ where: { id: poolResult.id } })).distanceMeters, 100);
  assert.equal((await db.openWaterResult.findUniqueOrThrow({ where: { id: waterResult.id } })).distanceMeters, 1500);
  await rejectsConstraint(
    () => db.openWaterResult.create({
      data: { studentId, heldOn: new Date('2026-10-20'), distanceMeters: 0 },
    }),
    'zero-meter open-water result',
  );
  await rejectsConstraint(
    () => db.poolResult.create({
      data: { studentId, heldOn: new Date('2026-10-20'), distanceMeters: 50, style: 'FREE', status: 'CLASSIFIED' },
    }),
    'classified pool result missing time',
  );

  // Deleting a student with competition history must fail; no silent loss.
  await rejectsConstraint(() => db.student.delete({ where: { id: studentId } }), 'results must be retained');
  console.log('PASS: Prisma real DB: student, guardians, seasonal category, transfer, partial indexes,');
  console.log('      anthropometry NULL, technical template FK, pool/open-water results and retention.');
}
run().then(
  async () => { await db.$disconnect(); },
  async (error) => { console.error(error); await db.$disconnect(); process.exitCode = 1; },
);
