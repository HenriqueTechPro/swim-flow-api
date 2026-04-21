import type { Provider } from '@nestjs/common';
import { AttendanceRepository } from '@/domain/attendance/application/repositories/attendance-repository';
import { AuthDirectoryRepository } from '@/domain/auth/application/repositories/auth-directory-repository';
import { AuthProfilesRepository } from '@/domain/auth/application/repositories/auth-profiles-repository';
import { AuthSessionManager } from '@/domain/auth/application/repositories/auth-session-manager';
import { AuthSessionsRepository } from '@/domain/auth/application/repositories/auth-sessions-repository';
import { ClassesRepository } from '@/domain/classes/application/repositories/classes-repository';
import { EventsRepository } from '@/domain/events/application/repositories/events-repository';
import { ExStudentsRepository } from '@/domain/ex-students/application/repositories/ex-students-repository';
import { ParentsRepository } from '@/domain/parents/application/repositories/parents-repository';
import { PoolsRepository } from '@/domain/pools/application/repositories/pools-repository';
import { ResultsRepository } from '@/domain/results/application/repositories/results-repository';
import { StudentsRepository } from '@/domain/students/application/repositories/students-repository';
import { TeachersRepository } from '@/domain/teachers/application/repositories/teachers-repository';
import { TrainingsRepository } from '@/domain/trainings/application/repositories/trainings-repository';
import { ManagedUploadResourcesRepository } from '@/domain/uploads/application/repositories/managed-upload-resources-repository';
import { ManagedUploadsRepository } from '@/domain/uploads/application/repositories/managed-uploads-repository';
import { ListAttendanceRecordsUseCase } from '@/domain/attendance/application/use-cases/list-attendance-records';
import { GetAttendanceSummaryUseCase } from '@/domain/attendance/application/use-cases/get-attendance-summary';
import { SaveAttendanceBatchUseCase } from '@/domain/attendance/application/use-cases/save-attendance-batch';
import { ConfirmPasswordResetUseCase } from '@/domain/auth/application/use-cases/confirm-password-reset';
import { DeleteAccessProfileUseCase } from '@/domain/auth/application/use-cases/delete-access-profile';
import { GetProfileUseCase } from '@/domain/auth/application/use-cases/get-profile';
import { InviteUserUseCase } from '@/domain/auth/application/use-cases/invite-user';
import { ListAccessProfilesUseCase } from '@/domain/auth/application/use-cases/list-access-profiles';
import { LoginWithGoogleUseCase } from '@/domain/auth/application/use-cases/login-with-google';
import { LoginUseCase } from '@/domain/auth/application/use-cases/login';
import { LogoutUseCase } from '@/domain/auth/application/use-cases/logout';
import { RefreshSessionUseCase } from '@/domain/auth/application/use-cases/refresh-session';
import { RequestPasswordResetUseCase } from '@/domain/auth/application/use-cases/request-password-reset';
import { UpdateAccessProfileRoleUseCase } from '@/domain/auth/application/use-cases/update-access-profile-role';
import { UpdateProfileUseCase } from '@/domain/auth/application/use-cases/update-profile';
import { AddClassTeacherUseCase } from '@/domain/classes/application/use-cases/add-class-teacher';
import { CreateClassUseCase } from '@/domain/classes/application/use-cases/create-class';
import { DeleteClassUseCase } from '@/domain/classes/application/use-cases/delete-class';
import { ListClassesUseCase } from '@/domain/classes/application/use-cases/list-classes';
import { RemoveClassTeacherUseCase } from '@/domain/classes/application/use-cases/remove-class-teacher';
import { TransferClassStudentUseCase } from '@/domain/classes/application/use-cases/transfer-class-student';
import { TransferClassTeacherUseCase } from '@/domain/classes/application/use-cases/transfer-class-teacher';
import { UpdateClassTeacherRoleUseCase } from '@/domain/classes/application/use-cases/update-class-teacher-role';
import { UpdateClassUseCase } from '@/domain/classes/application/use-cases/update-class';
import { CreateEventUseCase } from '@/domain/events/application/use-cases/create-event';
import { DeleteEventUseCase } from '@/domain/events/application/use-cases/delete-event';
import { ListEventsUseCase } from '@/domain/events/application/use-cases/list-events';
import { UpdateEventUseCase } from '@/domain/events/application/use-cases/update-event';
import { CreateExStudentUseCase } from '@/domain/ex-students/application/use-cases/create-ex-student';
import { DeleteExStudentUseCase } from '@/domain/ex-students/application/use-cases/delete-ex-student';
import { GetExStudentsSummaryUseCase } from '@/domain/ex-students/application/use-cases/get-ex-students-summary';
import { ListExStudentsUseCase } from '@/domain/ex-students/application/use-cases/list-ex-students';
import { ReactivateExStudentUseCase } from '@/domain/ex-students/application/use-cases/reactivate-ex-student';
import { UpdateExStudentUseCase } from '@/domain/ex-students/application/use-cases/update-ex-student';
import { CreateParentUseCase } from '@/domain/parents/application/use-cases/create-parent';
import { DeleteParentUseCase } from '@/domain/parents/application/use-cases/delete-parent';
import { ListParentsUseCase } from '@/domain/parents/application/use-cases/list-parents';
import { UpdateParentUseCase } from '@/domain/parents/application/use-cases/update-parent';
import { CreatePoolUseCase } from '@/domain/pools/application/use-cases/create-pool';
import { DeletePoolUseCase } from '@/domain/pools/application/use-cases/delete-pool';
import { ListPoolsUseCase } from '@/domain/pools/application/use-cases/list-pools';
import { UpdatePoolUseCase } from '@/domain/pools/application/use-cases/update-pool';
import { CreateResultUseCase } from '@/domain/results/application/use-cases/create-result';
import { DeleteResultUseCase } from '@/domain/results/application/use-cases/delete-result';
import { GenerateRankingUseCase } from '@/domain/results/application/use-cases/generate-ranking';
import { GetResultEvolutionUseCase } from '@/domain/results/application/use-cases/get-result-evolution';
import { GetResultStyleDistributionUseCase } from '@/domain/results/application/use-cases/get-result-style-distribution';
import { GetResultsSummaryUseCase } from '@/domain/results/application/use-cases/get-results-summary';
import { ListResultCompetitionContextsUseCase } from '@/domain/results/application/use-cases/list-result-competition-contexts';
import { ListRecordsUseCase } from '@/domain/results/application/use-cases/list-records';
import { ListResultFilterOptionsUseCase } from '@/domain/results/application/use-cases/list-result-filter-options';
import { ListResultsUseCase } from '@/domain/results/application/use-cases/list-results';
import { UpdateResultUseCase } from '@/domain/results/application/use-cases/update-result';
import { CreateStudentUseCase } from '@/domain/students/application/use-cases/create-student';
import { DeleteStudentUseCase } from '@/domain/students/application/use-cases/delete-student';
import { ListStudentReferenceDataUseCase } from '@/domain/students/application/use-cases/list-student-reference-data';
import { ListStudentsUseCase } from '@/domain/students/application/use-cases/list-students';
import { UpdateStudentUseCase } from '@/domain/students/application/use-cases/update-student';
import { CreateTeacherUseCase } from '@/domain/teachers/application/use-cases/create-teacher';
import { DeleteTeacherUseCase } from '@/domain/teachers/application/use-cases/delete-teacher';
import { ListTeachersUseCase } from '@/domain/teachers/application/use-cases/list-teachers';
import { UpdateTeacherUseCase } from '@/domain/teachers/application/use-cases/update-teacher';
import { CreateTrainingUseCase } from '@/domain/trainings/application/use-cases/create-training';
import { DeleteTrainingUseCase } from '@/domain/trainings/application/use-cases/delete-training';
import { ListTrainingsUseCase } from '@/domain/trainings/application/use-cases/list-trainings';
import { UpdateTrainingUseCase } from '@/domain/trainings/application/use-cases/update-training';
import { CreateManagedUploadUseCase } from '@/domain/uploads/application/use-cases/create-managed-upload';

type UseCaseConstructor<TDependency, TUseCase> = new (
  dependency: TDependency,
) => TUseCase;

function provideUseCase<TDependency, TUseCase>(
  useCase: UseCaseConstructor<TDependency, TUseCase>,
  dependencyToken: abstract new (...args: never[]) => TDependency,
): Provider {
  return {
    provide: useCase,
    inject: [dependencyToken],
    useFactory: (dependency: TDependency) => new useCase(dependency),
  };
}

export const useCaseProviders: Provider[] = [
  provideUseCase(ListAttendanceRecordsUseCase, AttendanceRepository),
  provideUseCase(GetAttendanceSummaryUseCase, AttendanceRepository),
  provideUseCase(SaveAttendanceBatchUseCase, AttendanceRepository),
  provideUseCase(ConfirmPasswordResetUseCase, AuthSessionManager),
  {
    provide: DeleteAccessProfileUseCase,
    inject: [
      AuthProfilesRepository,
      AuthDirectoryRepository,
      AuthSessionsRepository,
    ],
    useFactory: (
      authProfilesRepository: AuthProfilesRepository,
      authDirectoryRepository: AuthDirectoryRepository,
      authSessionsRepository: AuthSessionsRepository,
    ) =>
      new DeleteAccessProfileUseCase(
        authProfilesRepository,
        authDirectoryRepository,
        authSessionsRepository,
      ),
  },
  provideUseCase(GetProfileUseCase, AuthProfilesRepository),
  provideUseCase(InviteUserUseCase, AuthSessionManager),
  {
    provide: ListAccessProfilesUseCase,
    inject: [AuthProfilesRepository, AuthDirectoryRepository],
    useFactory: (
      authProfilesRepository: AuthProfilesRepository,
      authDirectoryRepository: AuthDirectoryRepository,
    ) =>
      new ListAccessProfilesUseCase(
        authProfilesRepository,
        authDirectoryRepository,
      ),
  },
  provideUseCase(LoginUseCase, AuthSessionManager),
  provideUseCase(LoginWithGoogleUseCase, AuthSessionManager),
  provideUseCase(LogoutUseCase, AuthSessionManager),
  provideUseCase(RefreshSessionUseCase, AuthSessionManager),
  provideUseCase(RequestPasswordResetUseCase, AuthSessionManager),
  provideUseCase(UpdateAccessProfileRoleUseCase, AuthProfilesRepository),
  provideUseCase(UpdateProfileUseCase, AuthProfilesRepository),
  provideUseCase(AddClassTeacherUseCase, ClassesRepository),
  provideUseCase(CreateClassUseCase, ClassesRepository),
  provideUseCase(DeleteClassUseCase, ClassesRepository),
  provideUseCase(ListClassesUseCase, ClassesRepository),
  provideUseCase(RemoveClassTeacherUseCase, ClassesRepository),
  provideUseCase(TransferClassStudentUseCase, ClassesRepository),
  provideUseCase(TransferClassTeacherUseCase, ClassesRepository),
  provideUseCase(UpdateClassTeacherRoleUseCase, ClassesRepository),
  provideUseCase(UpdateClassUseCase, ClassesRepository),
  provideUseCase(CreateEventUseCase, EventsRepository),
  provideUseCase(DeleteEventUseCase, EventsRepository),
  provideUseCase(ListEventsUseCase, EventsRepository),
  provideUseCase(UpdateEventUseCase, EventsRepository),
  provideUseCase(CreateExStudentUseCase, ExStudentsRepository),
  provideUseCase(DeleteExStudentUseCase, ExStudentsRepository),
  provideUseCase(GetExStudentsSummaryUseCase, ExStudentsRepository),
  provideUseCase(ListExStudentsUseCase, ExStudentsRepository),
  provideUseCase(ReactivateExStudentUseCase, ExStudentsRepository),
  provideUseCase(UpdateExStudentUseCase, ExStudentsRepository),
  provideUseCase(CreateParentUseCase, ParentsRepository),
  provideUseCase(DeleteParentUseCase, ParentsRepository),
  provideUseCase(ListParentsUseCase, ParentsRepository),
  provideUseCase(UpdateParentUseCase, ParentsRepository),
  provideUseCase(CreatePoolUseCase, PoolsRepository),
  provideUseCase(DeletePoolUseCase, PoolsRepository),
  provideUseCase(ListPoolsUseCase, PoolsRepository),
  provideUseCase(UpdatePoolUseCase, PoolsRepository),
  provideUseCase(CreateResultUseCase, ResultsRepository),
  provideUseCase(DeleteResultUseCase, ResultsRepository),
  provideUseCase(GenerateRankingUseCase, ResultsRepository),
  provideUseCase(GetResultEvolutionUseCase, ResultsRepository),
  provideUseCase(GetResultStyleDistributionUseCase, ResultsRepository),
  provideUseCase(GetResultsSummaryUseCase, ResultsRepository),
  provideUseCase(ListResultCompetitionContextsUseCase, ResultsRepository),
  provideUseCase(ListRecordsUseCase, ResultsRepository),
  provideUseCase(ListResultFilterOptionsUseCase, ResultsRepository),
  provideUseCase(ListResultsUseCase, ResultsRepository),
  provideUseCase(UpdateResultUseCase, ResultsRepository),
  provideUseCase(CreateStudentUseCase, StudentsRepository),
  provideUseCase(DeleteStudentUseCase, StudentsRepository),
  provideUseCase(ListStudentReferenceDataUseCase, StudentsRepository),
  provideUseCase(ListStudentsUseCase, StudentsRepository),
  provideUseCase(UpdateStudentUseCase, StudentsRepository),
  provideUseCase(CreateTeacherUseCase, TeachersRepository),
  provideUseCase(DeleteTeacherUseCase, TeachersRepository),
  provideUseCase(ListTeachersUseCase, TeachersRepository),
  provideUseCase(UpdateTeacherUseCase, TeachersRepository),
  provideUseCase(CreateTrainingUseCase, TrainingsRepository),
  provideUseCase(DeleteTrainingUseCase, TrainingsRepository),
  provideUseCase(ListTrainingsUseCase, TrainingsRepository),
  provideUseCase(UpdateTrainingUseCase, TrainingsRepository),
  {
    provide: CreateManagedUploadUseCase,
    inject: [ManagedUploadsRepository, ManagedUploadResourcesRepository],
    useFactory: (
      managedUploadsRepository: ManagedUploadsRepository,
      managedUploadResourcesRepository: ManagedUploadResourcesRepository,
    ) =>
      new CreateManagedUploadUseCase(
        managedUploadsRepository,
        managedUploadResourcesRepository,
      ),
  },
];

