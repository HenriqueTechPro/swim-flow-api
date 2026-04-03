import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { createResultSchema, updateResultSchema, type CreateResultDto, type UpdateResultDto } from '@/shared/contracts/management'
import { CreateResultUseCase } from '@/domain/results/application/use-cases/create-result'
import { DeleteResultUseCase } from '@/domain/results/application/use-cases/delete-result'
import { ListResultFilterOptionsUseCase } from '@/domain/results/application/use-cases/list-result-filter-options'
import { ListResultsUseCase } from '@/domain/results/application/use-cases/list-results'
import { UpdateResultUseCase } from '@/domain/results/application/use-cases/update-result'
import { normalizePaginationParams } from '@/domain/shared/pagination/pagination-utils'
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard'
import { Roles } from '@/infra/auth/roles.decorator'
import { RolesGuard } from '@/infra/auth/roles.guard'
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
  async index(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('search') search?: string,
    @Query('discipline') discipline?: string,
    @Query('style') style?: string,
    @Query('distance') distance?: string,
    @Query('competition') competition?: string,
    @Query('eventFormat') eventFormat?: string,
    @Query('resultStatus') resultStatus?: 'Classificado' | 'Desclassificado',
    @Query('category') category?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('studentId') studentId?: string,
  ) {
    const pagination = normalizePaginationParams({ page: Number(page), perPage: Number(perPage) })
    const { results, meta } = await this.listResults.execute({
      page: pagination.page,
      perPage: pagination.perPage,
      search,
      discipline,
      style,
      distance,
      competition,
      eventFormat,
      resultStatus,
      category,
      startDate,
      endDate,
      studentId,
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
