import { Module } from '@nestjs/common'
import { CacheModule } from '@/infra/cache/cache.module'
import { EnvModule } from '@/infra/env/env.module'
import { AttendanceRepository } from '@/domain/attendance/application/repositories/attendance-repository'
import { ClassesRepository } from '@/domain/classes/application/repositories/classes-repository'
import { ExStudentsRepository } from '@/domain/ex-students/application/repositories/ex-students-repository'
import { EventsRepository } from '@/domain/events/application/repositories/events-repository'
import { ParentsRepository } from '@/domain/parents/application/repositories/parents-repository'
import { PoolsRepository } from '@/domain/pools/application/repositories/pools-repository'
import { ResultsRepository } from '@/domain/results/application/repositories/results-repository'
import { StudentsRepository } from '@/domain/students/application/repositories/students-repository'
import { TeachersRepository } from '@/domain/teachers/application/repositories/teachers-repository'
import { TrainingsRepository } from '@/domain/trainings/application/repositories/trainings-repository'
import { PrismaAttendanceRepository } from './prisma/repositories/prisma-attendance-repository'
import { PrismaExStudentsRepository } from './prisma/repositories/prisma-ex-students-repository'
import { PrismaEventsRepository } from './prisma/repositories/prisma-events-repository'
import { PrismaParentsRepository } from './prisma/repositories/prisma-parents-repository'
import { PrismaPoolsRepository } from './prisma/repositories/prisma-pools-repository'
import { PrismaResultsRepository } from './prisma/repositories/prisma-results-repository'
import { PrismaService } from './prisma/prisma.service'
import { PrismaClassesRepository } from './prisma/repositories/prisma-classes-repository'
import { PrismaStudentsRepository } from './prisma/repositories/prisma-students-repository'
import { PrismaTeachersRepository } from './prisma/repositories/prisma-teachers-repository'
import { PrismaTrainingsRepository } from './prisma/repositories/prisma-trainings-repository'

@Module({
  imports: [CacheModule, EnvModule],
  providers: [
    PrismaService,
    {
      provide: AttendanceRepository,
      useClass: PrismaAttendanceRepository,
    },
    {
      provide: ClassesRepository,
      useClass: PrismaClassesRepository,
    },
    {
      provide: ParentsRepository,
      useClass: PrismaParentsRepository,
    },
    {
      provide: EventsRepository,
      useClass: PrismaEventsRepository,
    },
    {
      provide: ExStudentsRepository,
      useClass: PrismaExStudentsRepository,
    },
    {
      provide: PoolsRepository,
      useClass: PrismaPoolsRepository,
    },
    {
      provide: ResultsRepository,
      useClass: PrismaResultsRepository,
    },
    {
      provide: StudentsRepository,
      useClass: PrismaStudentsRepository,
    },
    {
      provide: TeachersRepository,
      useClass: PrismaTeachersRepository,
    },
    {
      provide: TrainingsRepository,
      useClass: PrismaTrainingsRepository,
    },
  ],
  exports: [PrismaService, AttendanceRepository, ClassesRepository, ExStudentsRepository, EventsRepository, ParentsRepository, PoolsRepository, ResultsRepository, StudentsRepository, TeachersRepository, TrainingsRepository],
})
export class DatabaseModule {}
