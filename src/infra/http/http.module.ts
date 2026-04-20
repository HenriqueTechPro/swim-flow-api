import { Module } from '@nestjs/common';
import { ManagedUploadsRepository } from '@/domain/uploads/application/repositories/managed-uploads-repository';
import { AuthModule } from '@/infra/auth/auth.module';
import { DatabaseModule } from '@/infra/database/database.module';
import { EnvModule } from '@/infra/env/env.module';
import { SupabaseManagedUploadsRepository } from '@/infra/supabase/managed-uploads.service';
import { AttendanceController } from './controllers/attendance.controller';
import { AuthController } from './controllers/auth.controller';
import { ClassesController } from './controllers/classes.controller';
import { ExStudentsController } from './controllers/ex-students.controller';
import { EventsController } from './controllers/events.controller';
import { ParentsController } from './controllers/parents.controller';
import { PublicResultsController } from './controllers/public-results.controller';
import { PoolsController } from './controllers/pools.controller';
import { ProfileController } from './controllers/profile.controller';
import { ResultsController } from './controllers/results.controller';
import { StudentsController } from './controllers/students.controller';
import { TeachersController } from './controllers/teachers.controller';
import { TrainingsController } from './controllers/trainings.controller';
import { UploadsController } from './controllers/uploads.controller';
import { useCaseProviders } from './use-case.providers';

@Module({
  imports: [DatabaseModule, AuthModule, EnvModule],
  controllers: [
    AttendanceController,
    AuthController,
    ClassesController,
    ExStudentsController,
    EventsController,
    ParentsController,
    PublicResultsController,
    PoolsController,
    ProfileController,
    ResultsController,
    StudentsController,
    TeachersController,
    TrainingsController,
    UploadsController,
  ],
  providers: [
    SupabaseManagedUploadsRepository,
    {
      provide: ManagedUploadsRepository,
      useExisting: SupabaseManagedUploadsRepository,
    },
    ...useCaseProviders,
  ],
})
export class HttpModule {}


