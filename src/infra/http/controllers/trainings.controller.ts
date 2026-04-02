import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { createTrainingSchema, updateTrainingSchema, type CreateTrainingDto, type UpdateTrainingDto } from '@/shared/contracts/management'
import { CreateTrainingUseCase } from '@/domain/trainings/application/use-cases/create-training'
import { DeleteTrainingUseCase } from '@/domain/trainings/application/use-cases/delete-training'
import { ListTrainingsUseCase } from '@/domain/trainings/application/use-cases/list-trainings'
import { UpdateTrainingUseCase } from '@/domain/trainings/application/use-cases/update-training'
import { normalizePaginationParams } from '@/domain/shared/pagination/pagination-utils'
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard'
import { Roles } from '@/infra/auth/roles.decorator'
import { RolesGuard } from '@/infra/auth/roles.guard'
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
    private readonly deleteTraining: DeleteTrainingUseCase,
  ) {}

  @Get()
  async index(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('poolId') poolId?: string,
  ) {
    const pagination = normalizePaginationParams({ page: Number(page), perPage: Number(perPage) })
    const { trainings, meta } = await this.listTrainings.execute({
      page: pagination.page,
      perPage: pagination.perPage,
      search,
      type,
      status,
      poolId,
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

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const { training } = await this.deleteTraining.execute(id)
    return { data: TrainingPresenter.toHTTP(training) }
  }
}
