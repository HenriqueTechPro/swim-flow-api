import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { createResultSchema, updateResultSchema, type CreateResultDto, type UpdateResultDto } from '@/shared/contracts/results.contracts'
import { CreateResultUseCase } from '@/domain/results/application/use-cases/create-result'
import { DeleteResultUseCase } from '@/domain/results/application/use-cases/delete-result'
import { ListResultFilterOptionsUseCase } from '@/domain/results/application/use-cases/list-result-filter-options'
import { ListResultsUseCase } from '@/domain/results/application/use-cases/list-results'
import { UpdateResultUseCase } from '@/domain/results/application/use-cases/update-result'
import { normalizePaginationParams } from '@/domain/shared/pagination/pagination-utils'
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard'
import { Roles } from '@/infra/auth/roles.decorator'
import { RolesGuard } from '@/infra/auth/roles.guard'
import { resultsListQuerySchema, type ResultsListQuery } from '../queries/list-query-schemas'
import { ZodValidationPipe } from '../pipes/zod-validation-pipe'
import { ResultRequestMapper } from '../mappers/result-request.mapper'
import { ResultPresenter } from '../presenters/result.presenter'

@ApiTags('results')
@ApiBearerAuth('supabase-bearer')
@Controller('/api/results')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'teacher')
export class ResultsController {
  constructor(
    private readonly listResults: ListResultsUseCase,
    private readonly listResultFilterOptions: ListResultFilterOptionsUseCase,
    private readonly createResult: CreateResultUseCase,
    private readonly updateResult: UpdateResultUseCase,
    private readonly deleteResult: DeleteResultUseCase,
  ) {}

  @Get('options')
  async options() {
    const { options } = await this.listResultFilterOptions.execute()
    return { data: options }
  }

  @Get()
  async index(@Query(new ZodValidationPipe(resultsListQuerySchema)) query: ResultsListQuery) {
    const pagination = normalizePaginationParams({ page: query.page, perPage: query.perPage })
    const { results, meta } = await this.listResults.execute({
      page: pagination.page,
      perPage: pagination.perPage,
      search: query.search,
      discipline: query.discipline,
      style: query.style,
      distance: query.distance,
      competition: query.competition,
      eventFormat: query.eventFormat,
      resultStatus: query.resultStatus,
      category: query.category,
      startDate: query.startDate,
      endDate: query.endDate,
      studentId: query.studentId,
    })
    return { data: results.map(ResultPresenter.toHTTP), meta }
  }

  @Post()
  async create(@Body(new ZodValidationPipe(createResultSchema)) body: CreateResultDto) {
    const { result } = await this.createResult.execute(ResultRequestMapper.toCreate(body))
    return { data: ResultPresenter.toHTTP(result) }
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body(new ZodValidationPipe(updateResultSchema)) body: UpdateResultDto) {
    const { result } = await this.updateResult.execute(id, ResultRequestMapper.toUpdate(body))
    return { data: ResultPresenter.toHTTP(result) }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const { result } = await this.deleteResult.execute(id)
    return { data: ResultPresenter.toHTTP(result) }
  }
}
