import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  resultsRankingQuerySchema,
  type ResultsRankingQueryDto,
} from '@/shared/contracts/management';
import { GenerateRankingUseCase } from '@/domain/results/application/use-cases/generate-ranking';
import { ListResultCompetitionContextsUseCase } from '@/domain/results/application/use-cases/list-result-competition-contexts';
import { ListResultsUseCase } from '@/domain/results/application/use-cases/list-results';
import { normalizePaginationParams } from '@/domain/shared/pagination/pagination-utils';
import { ZodValidationPipe } from '../pipes/zod-validation-pipe';
import { PublicResultPresenter } from '../presenters/public-result.presenter';
import { ResultRankingPresenter } from '../presenters/result-ranking.presenter';

@ApiTags('public-results')
@Controller('/api/public/results')
export class PublicResultsController {
  constructor(
    private readonly generateRanking: GenerateRankingUseCase,
    private readonly listResultCompetitionContexts: ListResultCompetitionContextsUseCase,
    private readonly listResults: ListResultsUseCase,
  ) {}

  @Get('contexts')
  async contexts(
    @Query('discipline') discipline?: string,
    @Query('category') category?: string,
  ) {
    const { contexts } = await this.listResultCompetitionContexts.execute({
      discipline,
      category,
      resultStatus: 'Classificado',
    });

    return {
      data: contexts,
    };
  }

  @Get('ranking')
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
  async index(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('search') search?: string,
    @Query('discipline') discipline?: string,
    @Query('style') style?: string,
    @Query('eventFormat') eventFormat?: string,
    @Query('resultStatus') resultStatus?: string,
    @Query('distance') distance?: string,
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
      style,
      eventFormat,
      resultStatus,
      distance,
      competition,
      category,
      startDate,
      endDate,
      studentId,
    });

    return {
      data: results.map(PublicResultPresenter.toHTTP),
      meta,
    };
  }
}
