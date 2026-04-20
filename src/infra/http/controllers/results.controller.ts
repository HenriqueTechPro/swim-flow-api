import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createResultSchema,
  resultsRankingQuerySchema,
  updateResultSchema,
  type CreateResultDto,
  type ResultsRankingQueryDto,
  type UpdateResultDto,
} from '@/shared/contracts/management';
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
import { normalizePaginationParams } from '@/domain/shared/pagination/pagination-utils';
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard';
import { Permissions } from '@/infra/auth/permissions.decorator';
import { PermissionsGuard } from '@/infra/auth/permissions.guard';
import { Roles } from '@/infra/auth/roles.decorator';
import { RolesGuard } from '@/infra/auth/roles.guard';
import { ZodValidationPipe } from '../pipes/zod-validation-pipe';
import { ResultRequestMapper } from '../mappers/result-request.mapper';
import { ResultPresenter } from '../presenters/result.presenter';
import { ResultRankingPresenter } from '../presenters/result-ranking.presenter';

@ApiTags('results')
@ApiBearerAuth('api-bearer')
@Controller('/api/results')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin', 'teacher')
export class ResultsController {
  constructor(
    private readonly generateRanking: GenerateRankingUseCase,
    private readonly getResultEvolution: GetResultEvolutionUseCase,
    private readonly getResultStyleDistribution: GetResultStyleDistributionUseCase,
    private readonly getResultsSummary: GetResultsSummaryUseCase,
    private readonly listResultCompetitionContexts: ListResultCompetitionContextsUseCase,
    private readonly listRecords: ListRecordsUseCase,
    private readonly listResultFilterOptions: ListResultFilterOptionsUseCase,
    private readonly listResults: ListResultsUseCase,
    private readonly createResult: CreateResultUseCase,
    private readonly updateResult: UpdateResultUseCase,
    private readonly deleteResult: DeleteResultUseCase,
  ) {}

  @Get('summary')
  @Permissions('results:read')
  async summary(
    @Query('search') search?: string,
    @Query('discipline') discipline?: string,
    @Query('competitionType') competitionType?: string,
    @Query('courseType') courseType?: string,
    @Query('style') style?: string,
    @Query('eventFormat') eventFormat?: string,
    @Query('resultStatus') resultStatus?: string,
    @Query('distance') distance?: string,
    @Query('customDistance') customDistance?: string,
    @Query('competition') competition?: string,
    @Query('category') category?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('studentId') studentId?: string,
  ) {
    const { summary } = await this.getResultsSummary.execute({
      search,
      discipline,
      competitionType,
      courseType,
      style,
      eventFormat,
      resultStatus,
      distance,
      customDistance,
      competition,
      category,
      startDate,
      endDate,
      studentId,
    });

    return { data: summary };
  }

  @Get('options')
  @Permissions('results:read')
  async options() {
    const { options } = await this.listResultFilterOptions.execute();

    return { data: options };
  }

  @Get('contexts')
  @Permissions('results:read')
  async contexts(
    @Query('search') search?: string,
    @Query('discipline') discipline?: string,
    @Query('competitionType') competitionType?: string,
    @Query('courseType') courseType?: string,
    @Query('style') style?: string,
    @Query('eventFormat') eventFormat?: string,
    @Query('resultStatus') resultStatus?: string,
    @Query('distance') distance?: string,
    @Query('customDistance') customDistance?: string,
    @Query('competition') competition?: string,
    @Query('category') category?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('studentId') studentId?: string,
  ) {
    const { contexts } = await this.listResultCompetitionContexts.execute({
      search,
      discipline,
      competitionType,
      courseType,
      style,
      eventFormat,
      resultStatus,
      distance,
      customDistance,
      competition,
      category,
      startDate,
      endDate,
      studentId,
    });

    return { data: contexts };
  }

  @Get('style-distribution')
  @Permissions('results:read')
  async styleDistribution(
    @Query('search') search?: string,
    @Query('discipline') discipline?: string,
    @Query('competitionType') competitionType?: string,
    @Query('courseType') courseType?: string,
    @Query('style') style?: string,
    @Query('eventFormat') eventFormat?: string,
    @Query('resultStatus') resultStatus?: string,
    @Query('distance') distance?: string,
    @Query('customDistance') customDistance?: string,
    @Query('competition') competition?: string,
    @Query('category') category?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('studentId') studentId?: string,
  ) {
    const { distribution } = await this.getResultStyleDistribution.execute({
      search,
      discipline,
      competitionType,
      courseType,
      style,
      eventFormat,
      resultStatus,
      distance,
      customDistance,
      competition,
      category,
      startDate,
      endDate,
      studentId,
    });

    return { data: distribution };
  }

  @Get('evolution')
  @Permissions('results:read')
  async evolution(
    @Query('search') search?: string,
    @Query('discipline') discipline?: string,
    @Query('competitionType') competitionType?: string,
    @Query('courseType') courseType?: string,
    @Query('style') style?: string,
    @Query('eventFormat') eventFormat?: string,
    @Query('resultStatus') resultStatus?: string,
    @Query('distance') distance?: string,
    @Query('customDistance') customDistance?: string,
    @Query('competition') competition?: string,
    @Query('category') category?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('studentId') studentId?: string,
    @Query('focusStudentId') focusStudentId?: string,
    @Query('chartStartDate') chartStartDate?: string,
    @Query('chartEndDate') chartEndDate?: string,
  ) {
    const { evolution } = await this.getResultEvolution.execute({
      search,
      discipline,
      competitionType,
      courseType,
      style,
      eventFormat,
      resultStatus,
      distance,
      customDistance,
      competition,
      category,
      startDate,
      endDate,
      studentId,
      focusStudentId,
      chartStartDate,
      chartEndDate,
    });

    return { data: evolution };
  }

  @Get('records')
  @Permissions('results:read')
  async records(
    @Query('search') search?: string,
    @Query('discipline') discipline?: string,
    @Query('competitionType') competitionType?: string,
    @Query('courseType') courseType?: string,
    @Query('style') style?: string,
    @Query('eventFormat') eventFormat?: string,
    @Query('resultStatus') resultStatus?: string,
    @Query('distance') distance?: string,
    @Query('customDistance') customDistance?: string,
    @Query('competition') competition?: string,
    @Query('category') category?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('studentId') studentId?: string,
  ) {
    const { records, meta } = await this.listRecords.execute({
      search,
      discipline,
      competitionType,
      courseType,
      style,
      eventFormat,
      resultStatus,
      distance,
      customDistance,
      competition,
      category,
      startDate,
      endDate,
      studentId,
    });

    return { data: records.map(ResultPresenter.toHTTP), meta };
  }

  @Get('ranking')
  @Permissions('results:read')
  async ranking(
    @Query(new ZodValidationPipe(resultsRankingQuerySchema))
    query: ResultsRankingQueryDto,
  ) {
    const { ranking, meta } = await this.generateRanking.execute({
      ...query,
      courseType: query.courseType || undefined,
      customDistance: query.customDistance || undefined,
    });

    return {
      data: ranking.map(ResultRankingPresenter.toHTTP),
      meta,
    };
  }

  @Get()
  @Permissions('results:read')
  async index(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('search') search?: string,
    @Query('discipline') discipline?: string,
    @Query('competitionType') competitionType?: string,
    @Query('courseType') courseType?: string,
    @Query('style') style?: string,
    @Query('eventFormat') eventFormat?: string,
    @Query('resultStatus') resultStatus?: string,
    @Query('distance') distance?: string,
    @Query('customDistance') customDistance?: string,
    @Query('competition') competition?: string,
    @Query('category') category?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('studentId') studentId?: string,
  ) {
    const pagination = normalizePaginationParams({
      page: Number(page),
      perPage: Number(perPage),
    });
    const { results, meta } = await this.listResults.execute({
      page: pagination.page,
      perPage: pagination.perPage,
      search,
      discipline,
      competitionType,
      courseType,
      style,
      eventFormat,
      resultStatus,
      distance,
      customDistance,
      competition,
      category,
      startDate,
      endDate,
      studentId,
    });
    return { data: results.map(ResultPresenter.toHTTP), meta };
  }

  @Post()
  @Permissions('results:write')
  async create(
    @Body(new ZodValidationPipe(createResultSchema)) body: CreateResultDto,
  ) {
    const { result } = await this.createResult.execute(
      ResultRequestMapper.toCreate(body),
    );
    return { data: ResultPresenter.toHTTP(result) };
  }

  @Put(':id')
  @Permissions('results:write')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateResultSchema)) body: UpdateResultDto,
  ) {
    const { result } = await this.updateResult.execute(
      id,
      ResultRequestMapper.toUpdate(body),
    );
    return { data: ResultPresenter.toHTTP(result) };
  }

  @Delete(':id')
  @Permissions('results:write')
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    const { result } = await this.deleteResult.execute(id);
    return { data: ResultPresenter.toHTTP(result) };
  }
}

