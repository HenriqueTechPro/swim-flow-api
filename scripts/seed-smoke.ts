import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { faker } from '@faker-js/faker'
import { PrismaClient } from '@prisma/client'
import { getCategoryByBirthYear } from '../src/shared/lib/categories'
import { normalizeHumanLabel, parseCategoryValue } from '../src/shared/utils/domain-formatters'

const SMOKE_PREFIX = 'SMOKE'
const SMOKE_EMAIL_DOMAIN = 'smoke.local'
const SEED_VALUE = 20260410

const loadEnvFile = (filepath: string) => {
  if (!existsSync(filepath)) return

  const content = readFileSync(filepath, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) continue

    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '')

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

const rootDir = resolve(__dirname, '..')
loadEnvFile(resolve(rootDir, '.env'))
loadEnvFile(resolve(rootDir, '.env.local'))

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to run the smoke seed.')
}

faker.seed(SEED_VALUE)

const prisma = new PrismaClient()

const toTimeDate = (value: string) => new Date(`1970-01-01T${value}:00.000Z`)

const createSmokeEmail = (slug: string) => `${slug}@${SMOKE_EMAIL_DOMAIN}`

const createBrazilPhone = () =>
  `(${faker.string.numeric(2)}) 9${faker.string.numeric(4)}-${faker.string.numeric(4)}`

const resolveCategoryName = (birthYear: number) => parseCategoryValue(getCategoryByBirthYear(birthYear))

const findLevelId = async (name: string) => {
  const levels = await prisma.level.findMany({
    select: { id: true, name: true },
  })

  const normalizedName = normalizeHumanLabel(name)
  const level = levels.find((item) => normalizeHumanLabel(item.name) === normalizedName)
  if (!level) {
    throw new Error(`Level "${name}" not found`)
  }

  return level.id
}

const findCategoryId = async (name: string) => {
  const category = await prisma.category.findFirst({
    where: { name: name as never },
    select: { id: true },
  })

  if (!category) {
    throw new Error(`Category "${name}" not found`)
  }

  return category.id
}

const cleanupSmokeData = async () => {
  const [students, parents, teachers, classes, pools] = await Promise.all([
    prisma.student.findMany({
      where: { name: { startsWith: SMOKE_PREFIX } },
      select: { id: true },
    }),
    prisma.parent.findMany({
      where: {
        OR: [
          { name: { startsWith: SMOKE_PREFIX } },
          { email: { endsWith: `@${SMOKE_EMAIL_DOMAIN}` } },
        ],
      },
      select: { id: true },
    }),
    prisma.teacher.findMany({
      where: {
        OR: [
          { name: { startsWith: SMOKE_PREFIX } },
          { email: { endsWith: `@${SMOKE_EMAIL_DOMAIN}` } },
        ],
      },
      select: { id: true },
    }),
    prisma.swimmingClass.findMany({
      where: { name: { startsWith: SMOKE_PREFIX } },
      select: { id: true },
    }),
    prisma.pool.findMany({
      where: { name: { startsWith: SMOKE_PREFIX } },
      select: { id: true },
    }),
  ])

  const studentIds = students.map((item) => item.id)
  const parentIds = parents.map((item) => item.id)
  const teacherIds = teachers.map((item) => item.id)
  const classIds = classes.map((item) => item.id)
  const poolIds = pools.map((item) => item.id)

  await prisma.$transaction(async (tx) => {
    if (classIds.length > 0 || studentIds.length > 0) {
      await tx.attendanceRecord.deleteMany({
        where: {
          OR: [
            ...(classIds.length > 0 ? [{ classId: { in: classIds } }] : []),
            ...(studentIds.length > 0 ? [{ studentId: { in: studentIds } }] : []),
          ],
        },
      })
    }

    if (studentIds.length > 0) {
      await tx.result.deleteMany({ where: { studentId: { in: studentIds } } })
      await tx.exStudent.deleteMany({
        where: {
          OR: [
            { studentId: { in: studentIds } },
            { name: { startsWith: SMOKE_PREFIX } },
          ],
        },
      })
      await tx.studentClass.deleteMany({ where: { studentId: { in: studentIds } } })
    }

    if (classIds.length > 0) {
      await tx.classTeacher.deleteMany({ where: { classId: { in: classIds } } })
      await tx.classSchedule.deleteMany({ where: { classId: { in: classIds } } })
      await tx.swimmingClass.deleteMany({ where: { id: { in: classIds } } })
    }

    await tx.event.deleteMany({ where: { title: { startsWith: SMOKE_PREFIX } } })
    await tx.training.deleteMany({ where: { title: { startsWith: SMOKE_PREFIX } } })

    if (studentIds.length > 0) {
      await tx.student.deleteMany({ where: { id: { in: studentIds } } })
    }

    if (parentIds.length > 0) {
      await tx.parent.deleteMany({ where: { id: { in: parentIds } } })
    }

    if (teacherIds.length > 0) {
      await tx.teacherCertification.deleteMany({ where: { teacherId: { in: teacherIds } } })
      await tx.teacherCategory.deleteMany({ where: { teacherId: { in: teacherIds } } })
      await tx.teacher.deleteMany({ where: { id: { in: teacherIds } } })
    }

    if (poolIds.length > 0) {
      await tx.pool.deleteMany({ where: { id: { in: poolIds } } })
    }
  })
}

const main = async () => {
  await cleanupSmokeData()

  const inicianteLevelId = await findLevelId('Iniciante')
  const intermediarioLevelId = await findLevelId('Intermediario')
  const avancadoLevelId = await findLevelId('Avancado')

  const youngerBirthYear = 2014
  const olderBirthYear = 2010
  const youngerCategoryName = resolveCategoryName(youngerBirthYear)
  const olderCategoryName = resolveCategoryName(olderBirthYear)

  const youngerCategoryId = await findCategoryId(youngerCategoryName)
  const olderCategoryId = await findCategoryId(olderCategoryName)

  const pool25 = await prisma.pool.create({
    data: {
      name: `${SMOKE_PREFIX} Piscina 25m`,
      lengthMeters: 25,
      address: faker.location.streetAddress(),
      status: 'Ativa',
      maxCapacity: 28,
    },
  })

  const pool50 = await prisma.pool.create({
    data: {
      name: `${SMOKE_PREFIX} Piscina 50m`,
      lengthMeters: 50,
      address: faker.location.streetAddress(),
      status: 'Manutencao',
      maxCapacity: 40,
    },
  })

  const teacherOne = await prisma.teacher.create({
    data: {
      name: `${SMOKE_PREFIX} ${faker.person.fullName()}`,
      email: createSmokeEmail('teacher.head'),
      phone: createBrazilPhone(),
      speciality: 'Livre, Costas',
      experience: 8,
      status: 'Ativo',
      bio: 'Professor gerado automaticamente para validacao local.',
      cpf: null,
    },
  })

  const teacherTwo = await prisma.teacher.create({
    data: {
      name: `${SMOKE_PREFIX} ${faker.person.fullName()}`,
      email: createSmokeEmail('teacher.assistant'),
      phone: createBrazilPhone(),
      speciality: 'Aguas Abertas',
      experience: 5,
      status: 'Ativo',
      bio: 'Professor auxiliar gerado automaticamente para validacao local.',
      cpf: null,
    },
  })

  await prisma.teacherCategory.createMany({
    data: [
      { teacherId: teacherOne.id, categoryId: youngerCategoryId },
      { teacherId: teacherOne.id, categoryId: olderCategoryId },
      { teacherId: teacherTwo.id, categoryId: olderCategoryId },
    ],
  })

  await prisma.teacherCertification.createMany({
    data: [
      { teacherId: teacherOne.id, name: 'CBDA Nivel 1' },
      { teacherId: teacherTwo.id, name: 'Primeiros Socorros' },
    ],
  })

  const parent = await prisma.parent.create({
    data: {
      name: `${SMOKE_PREFIX} ${faker.person.fullName()}`,
      email: createSmokeEmail('parent.guardian'),
      phone: createBrazilPhone(),
      profession: faker.person.jobTitle(),
      address: faker.location.streetAddress(),
      emergencyContact: faker.person.fullName(),
      emergencyPhone: createBrazilPhone(),
      status: 'Ativo',
      cpf: null,
      photo: null,
    },
  })

  const studentOne = await prisma.student.create({
    data: {
      name: `${SMOKE_PREFIX} ${faker.person.firstName('male')} ${faker.person.lastName()}`,
      gender: 'Masculino',
      birthDate: new Date(`${youngerBirthYear}-05-12`),
      categoryId: youngerCategoryId,
      categoryLabel: youngerCategoryName,
      levelId: inicianteLevelId,
      levelLabel: 'Iniciante',
      parentId: parent.id,
      phone: parent.phone,
      status: 'Ativo',
      achievements: 1,
      lastCompetition: `${SMOKE_PREFIX} Festival Escolar`,
      photo: null,
    },
  })

  const studentTwo = await prisma.student.create({
    data: {
      name: `${SMOKE_PREFIX} ${faker.person.firstName('female')} ${faker.person.lastName()}`,
      gender: 'Feminino',
      birthDate: new Date(`${olderBirthYear}-08-21`),
      categoryId: olderCategoryId,
      categoryLabel: olderCategoryName,
      levelId: avancadoLevelId,
      levelLabel: 'Avançado',
      parentId: parent.id,
      phone: parent.phone,
      status: 'Ativo',
      achievements: 3,
      lastCompetition: `${SMOKE_PREFIX} Travessia`,
      photo: null,
    },
  })

  const swimClass = await prisma.swimmingClass.create({
    data: {
      name: `${SMOKE_PREFIX} Turma Principal`,
      categoryId: youngerCategoryId,
      maxStudents: 18,
      poolId: pool25.id,
      status: 'Ativa',
    },
  })

  await prisma.classCategory.createMany({
    data: [
      { classId: swimClass.id, categoryId: youngerCategoryId, isPrimary: true },
      { classId: swimClass.id, categoryId: olderCategoryId, isPrimary: false },
    ],
  })

  await prisma.classTeacher.createMany({
    data: [
      { classId: swimClass.id, teacherId: teacherOne.id, role: 'head_coach' },
      { classId: swimClass.id, teacherId: teacherTwo.id, role: 'assistant_coach' },
    ],
  })

  await prisma.classSchedule.createMany({
    data: [
      { classId: swimClass.id, dayOfWeek: 'Segunda', startTime: toTimeDate('06:30'), endTime: toTimeDate('07:30') },
      { classId: swimClass.id, dayOfWeek: 'Quarta', startTime: toTimeDate('06:30'), endTime: toTimeDate('07:30') },
    ],
  })

  await prisma.studentClass.createMany({
    data: [
      { studentId: studentOne.id, classId: swimClass.id, isPrimary: true },
      { studentId: studentTwo.id, classId: swimClass.id, isPrimary: false },
    ],
  })

  await prisma.training.createMany({
    data: [
      {
        title: `${SMOKE_PREFIX} Treino Tecnico`,
        description: 'Treino tecnico para validacao local',
        type: 'Misto',
        dayOfWeek: 'Terca',
        startTime: toTimeDate('07:00'),
        endTime: toTimeDate('08:00'),
        instructorId: teacherOne.id,
        level: 'Intermediario',
        maxParticipants: 20,
        currentParticipants: 8,
        status: 'Ativo',
        poolId: pool25.id,
      },
      {
        title: `${SMOKE_PREFIX} Treino Resistencia`,
        description: 'Treino de resistencia para validacao local',
        type: 'Resistencia',
        dayOfWeek: 'Sexta',
        startTime: toTimeDate('18:00'),
        endTime: toTimeDate('19:15'),
        instructorId: teacherTwo.id,
        level: 'Avancado',
        maxParticipants: 16,
        currentParticipants: 6,
        status: 'Ativo',
        poolId: pool50.id,
      },
    ],
  })

  await prisma.event.createMany({
    data: [
      {
        title: `${SMOKE_PREFIX} Festival Interno`,
        description: 'Evento de fumaça gerado automaticamente',
        type: 'Festival',
        date: new Date('2026-04-18'),
        startTime: toTimeDate('08:00'),
        endTime: toTimeDate('12:00'),
        location: pool25.name,
        status: 'Agendado',
      },
      {
        title: `${SMOKE_PREFIX} Reuniao Tecnica`,
        description: 'Reuniao para validar agenda local',
        type: 'Reuniao',
        date: new Date('2026-04-20'),
        startTime: toTimeDate('19:00'),
        endTime: toTimeDate('20:00'),
        location: faker.company.name(),
        status: 'Agendado',
      },
    ],
  })

  await prisma.result.createMany({
    data: [
      {
        studentId: studentOne.id,
        discipline: 'Piscina',
        style: 'Livre',
        distance: '100m',
        customDistance: '',
        competitionType: 'Piscina',
        courseType: 'Piscina Curta',
        eventFormat: 'Prova Individual',
        time: '01:16.32',
        timeInSeconds: 76.32,
        date: new Date('2026-04-05'),
        competition: `${SMOKE_PREFIX} Festival Interno`,
        position: 1,
        resultStatus: 'Classificado',
        personalBest: true,
        improvement: 1.8,
        category: youngerCategoryName,
        notes: 'Melhor marca da temporada de testes.',
      },
      {
        studentId: studentTwo.id,
        discipline: 'Aguas Abertas',
        style: 'Livre',
        distance: '1km',
        customDistance: '',
        competitionType: 'Aguas Abertas',
        courseType: 'Mar',
        eventFormat: 'Travessia',
        time: '15:42.10',
        timeInSeconds: 942.1,
        date: new Date('2026-04-06'),
        competition: `${SMOKE_PREFIX} Travessia`,
        position: 2,
        resultStatus: 'Classificado',
        personalBest: false,
        improvement: 0.5,
        category: olderCategoryName,
        notes: 'Resultado gerado para validar metragens abertas.',
      },
    ],
  })

  await prisma.attendanceRecord.createMany({
    data: [
      {
        studentId: studentOne.id,
        classId: swimClass.id,
        date: new Date('2026-04-09'),
        status: 'present',
        observations: 'Presenca de fumaca',
        savedAt: new Date('2026-04-09T10:00:00.000Z'),
      },
      {
        studentId: studentTwo.id,
        classId: swimClass.id,
        date: new Date('2026-04-09'),
        status: 'late',
        observations: 'Chegada com atraso controlado',
        savedAt: new Date('2026-04-09T10:00:00.000Z'),
      },
    ],
  })

  const summary = {
    pools: 2,
    teachers: 2,
    parents: 1,
    students: 2,
    classes: 1,
    trainings: 2,
    events: 2,
    results: 2,
    attendanceRecords: 2,
    levels: {
      inicianteLevelId,
      intermediarioLevelId,
      avancadoLevelId,
    },
  }

  console.log(JSON.stringify({ seed: SEED_VALUE, prefix: SMOKE_PREFIX, summary }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
