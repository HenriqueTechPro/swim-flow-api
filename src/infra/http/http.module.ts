import { Module } from '@nestjs/common'
import { ListAttendanceRecordsUseCase } from '@/domain/attendance/application/use-cases/list-attendance-records'
import { SaveAttendanceBatchUseCase } from '@/domain/attendance/application/use-cases/save-attendance-batch'
import { AddClassTeacherUseCase } from '@/domain/classes/application/use-cases/add-class-teacher'
import { CreateClassUseCase } from '@/domain/classes/application/use-cases/create-class'
import { DeleteClassUseCase } from '@/domain/classes/application/use-cases/delete-class'
import { ListClassesUseCase } from '@/domain/classes/application/use-cases/list-classes'
import { RemoveClassTeacherUseCase } from '@/domain/classes/application/use-cases/remove-class-teacher'
import { TransferClassTeacherUseCase } from '@/domain/classes/application/use-cases/transfer-class-teacher'
import { TransferClassStudentUseCase } from '@/domain/classes/application/use-cases/transfer-class-student'
import { UpdateClassUseCase } from '@/domain/classes/application/use-cases/update-class'
import { UpdateClassTeacherRoleUseCase } from '@/domain/classes/application/use-cases/update-class-teacher-role'
import { CreateEventUseCase } from '@/domain/events/application/use-cases/create-event'
import { DeleteEventUseCase } from '@/domain/events/application/use-cases/delete-event'
import { ListEventsUseCase } from '@/domain/events/application/use-cases/list-events'
import { UpdateEventUseCase } from '@/domain/events/application/use-cases/update-event'
import { CreateExStudentUseCase } from '@/domain/ex-students/application/use-cases/create-ex-student'
import { DeleteExStudentUseCase } from '@/domain/ex-students/application/use-cases/delete-ex-student'
import { ListExStudentsUseCase } from '@/domain/ex-students/application/use-cases/list-ex-students'
import { ReactivateExStudentUseCase } from '@/domain/ex-students/application/use-cases/reactivate-ex-student'
import { UpdateExStudentUseCase } from '@/domain/ex-students/application/use-cases/update-ex-student'
import { CreateParentUseCase } from '@/domain/parents/application/use-cases/create-parent'
import { DeleteParentUseCase } from '@/domain/parents/application/use-cases/delete-parent'
import { ListParentsUseCase } from '@/domain/parents/application/use-cases/list-parents'
import { UpdateParentUseCase } from '@/domain/parents/application/use-cases/update-parent'
import { CreatePoolUseCase } from '@/domain/pools/application/use-cases/create-pool'
import { DeletePoolUseCase } from '@/domain/pools/application/use-cases/delete-pool'
import { ListPoolsUseCase } from '@/domain/pools/application/use-cases/list-pools'
import { UpdatePoolUseCase } from '@/domain/pools/application/use-cases/update-pool'
import { CreateResultUseCase } from '@/domain/results/application/use-cases/create-result'
import { DeleteResultUseCase } from '@/domain/results/application/use-cases/delete-result'
import { ListResultFilterOptionsUseCase } from '@/domain/results/application/use-cases/list-result-filter-options'
import { ListResultsUseCase } from '@/domain/results/application/use-cases/list-results'
import { UpdateResultUseCase } from '@/domain/results/application/use-cases/update-result'
import { CreateStudentUseCase } from '@/domain/students/application/use-cases/create-student'
import { DeleteStudentUseCase } from '@/domain/students/application/use-cases/delete-student'
import { ListStudentsUseCase } from '@/domain/students/application/use-cases/list-students'
import { UpdateStudentUseCase } from '@/domain/students/application/use-cases/update-student'
import { CreateTeacherUseCase } from '@/domain/teachers/application/use-cases/create-teacher'
import { DeleteTeacherUseCase } from '@/domain/teachers/application/use-cases/delete-teacher'
import { ListTeachersUseCase } from '@/domain/teachers/application/use-cases/list-teachers'
import { UpdateTeacherUseCase } from '@/domain/teachers/application/use-cases/update-teacher'
import { CreateTrainingUseCase } from '@/domain/trainings/application/use-cases/create-training'
import { DeleteTrainingUseCase } from '@/domain/trainings/application/use-cases/delete-training'
import { EnrollTrainingStudentUseCase } from '@/domain/trainings/application/use-cases/enroll-training-student'
import { ListTrainingsUseCase } from '@/domain/trainings/application/use-cases/list-trainings'
import { UnenrollTrainingStudentUseCase } from '@/domain/trainings/application/use-cases/unenroll-training-student'
import { UpdateTrainingUseCase } from '@/domain/trainings/application/use-cases/update-training'
import { AuthModule } from '@/infra/auth/auth.module'
import { DatabaseModule } from '@/infra/database/database.module'
import { EnvModule } from '@/infra/env/env.module'
import { AttendanceController } from './controllers/attendance.controller'
import { ClassesController } from './controllers/classes.controller'
import { ExStudentsController } from './controllers/ex-students.controller'
import { EventsController } from './controllers/events.controller'
import { ParentsController } from './controllers/parents.controller'
import { PoolsController } from './controllers/pools.controller'
import { ResultsController } from './controllers/results.controller'
import { StudentsController } from './controllers/students.controller'
import { TeachersController } from './controllers/teachers.controller'
import { TrainingsController } from './controllers/trainings.controller'

@Module({
  imports: [DatabaseModule, AuthModule, EnvModule],
  controllers: [AttendanceController, ClassesController, ExStudentsController, EventsController, ParentsController, PoolsController, ResultsController, StudentsController, TeachersController, TrainingsController],
  providers: [
    ListAttendanceRecordsUseCase,
    SaveAttendanceBatchUseCase,
    ListClassesUseCase,
    CreateClassUseCase,
    UpdateClassUseCase,
    AddClassTeacherUseCase,
    UpdateClassTeacherRoleUseCase,
    RemoveClassTeacherUseCase,
    TransferClassTeacherUseCase,
    TransferClassStudentUseCase,
    DeleteClassUseCase,
    ListEventsUseCase,
    CreateEventUseCase,
    UpdateEventUseCase,
    DeleteEventUseCase,
    ListExStudentsUseCase,
    CreateExStudentUseCase,
    UpdateExStudentUseCase,
    DeleteExStudentUseCase,
    ReactivateExStudentUseCase,
    ListParentsUseCase,
    CreateParentUseCase,
    UpdateParentUseCase,
    DeleteParentUseCase,
    ListPoolsUseCase,
    CreatePoolUseCase,
    UpdatePoolUseCase,
    DeletePoolUseCase,
    ListResultFilterOptionsUseCase,
    ListResultsUseCase,
    CreateResultUseCase,
    UpdateResultUseCase,
    DeleteResultUseCase,
    ListStudentsUseCase,
    CreateStudentUseCase,
    UpdateStudentUseCase,
    DeleteStudentUseCase,
    ListTeachersUseCase,
    CreateTeacherUseCase,
    UpdateTeacherUseCase,
    DeleteTeacherUseCase,
    ListTrainingsUseCase,
    CreateTrainingUseCase,
    UpdateTrainingUseCase,
    EnrollTrainingStudentUseCase,
    UnenrollTrainingStudentUseCase,
    DeleteTrainingUseCase,
  ],
})
export class HttpModule {}
