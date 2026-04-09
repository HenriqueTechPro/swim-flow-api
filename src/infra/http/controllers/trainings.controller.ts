import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import {
  createTrainingSchema,
  trainingEnrollmentSchema,
  updateTrainingSchema,
  type CreateTrainingDto,
  type TrainingEnrollmentDto,
  type UpdateTrainingDto,
} from '@/shared/contracts/trainings.contracts'
import { CreateTrainingUseCase } from '@/domain/trainings/application/use-cases/create-training'
import { DeleteTrainingUseCase } from '@/domain/trainings/application/use-cases/delete-training'
import { EnrollTrainingStudentUseCase } from '@/domain/trainings/application/use-cases/enroll-training-student'
import { ListTrainingsUseCase } from '@/domain/trainings/application/use-cases/list-trainings'
import { UnenrollTrainingStudentUseCase } from '@/domain/trainings/application/use-cases/unenroll-training-student'
import { UpdateTrainingUseCase } from '@/domain/trainings/application/use-cases/update-training'
import { normalizePaginationParams } from '@/domain/shared/pagination/pagination-utils'
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard'
import { Roles } from '@/infra/auth/roles.decorator'
import { RolesGuard } from '@/infra/auth/roles.guard'
import { trainingsListQuerySchema, type TrainingsListQuery } from '../queries/list-query-schemas'
import { ZodValidationPipe } from '../pipes/zod-validation-pipe'
import { TrainingRequestMapper } from '../mappers/training-request.mapper'
import { TrainingPresenter } from '../presenters/training.presenter'

@ApiTags('trainings')
@ApiBearerAuth('supabase-bearer')
@Controller('/api/trainings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'teacher')
export class TrainingsController {
  constructor(
    private readonly listTrainings: ListTrainingsUseCase,
    private readonly createTraining: CreateTrainingUseCase,
    private readonly updateTraining: UpdateTrainingUseCase,
    private readonly enrollTrainingStudent: EnrollTrainingStudentUseCase,
    private readonly unenrollTrainingStudent: UnenrollTrainingStudentUseCase,
    private readonly deleteTraining: DeleteTrainingUseCase,
  ) {}

  @Get()
  async index(@Query(new ZodValidationPipe(trainingsListQuerySchema)) query: TrainingsListQuery) {
    const pagination = normalizePaginationParams({ page: query.page, perPage: query.perPage })
    const { trainings, meta } = await this.listTrainings.execute({
      page: pagination.page,
      perPage: pagination.perPage,
      search: query.search,
      type: query.type,
      status: query.status,
      poolId: query.poolId,
    })
    return { data: trainings.map(TrainingPresenter.toHTTP), meta }
  }

  @Post()
  async create(@Body(new ZodValidationPipe(createTrainingSchema)) body: CreateTrainingDto) {
    const { training } = await this.createTraining.execute(TrainingRequestMapper.toCreate(body))
    return { data: TrainingPresenter.toHTTP(training) }
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body(new ZodValidationPipe(updateTrainingSchema)) body: UpdateTrainingDto) {
    const { training } = await this.updateTraining.execute(id, TrainingRequestMapper.toUpdate(body))
    return { data: TrainingPresenter.toHTTP(training) }
  }

  @Post(':id/enrollments')
  async enroll(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(trainingEnrollmentSchema)) body: TrainingEnrollmentDto,
  ) {
    const { training } = await this.enrollTrainingStudent.execute(id, TrainingRequestMapper.toEnrollment(body))
    return { data: TrainingPresenter.toHTTP(training) }
  }

  @Delete(':id/enrollments/:studentId')
  async unenroll(@Param('id') id: string, @Param('studentId') studentId: string) {
    const { training } = await this.unenrollTrainingStudent.execute(id, studentId)
    return { data: TrainingPresenter.toHTTP(training) }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const { training } = await this.deleteTraining.execute(id)
    return { data: TrainingPresenter.toHTTP(training) }
  }
}
