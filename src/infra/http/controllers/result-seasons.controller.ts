import {
  Body,
  Controller,
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
  resultSeasonsQuerySchema,
  resultSeasonOverviewQuerySchema,
  createResultSeasonSchema,
  updateResultSeasonSchema,
  type ResultSeasonsQueryDto,
  type ResultSeasonOverviewQueryDto,
  type CreateResultSeasonDto,
  type UpdateResultSeasonDto,
} from '@/shared/contracts/management';
import { ListResultSeasonsUseCase } from '@/domain/results/application/use-cases/list-result-seasons';
import { GetResultSeasonOverviewUseCase } from '@/domain/results/application/use-cases/get-result-season-overview';
import { GetStudentSeasonCompositionUseCase } from '@/domain/results/application/use-cases/get-student-season-composition';
import { CreateResultSeasonUseCase } from '@/domain/results/application/use-cases/create-result-season';
import { UpdateResultSeasonUseCase } from '@/domain/results/application/use-cases/update-result-season';
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard';
import { Permissions } from '@/infra/auth/permissions.decorator';
import { PermissionsGuard } from '@/infra/auth/permissions.guard';
import { Roles } from '@/infra/auth/roles.decorator';
import { RolesGuard } from '@/infra/auth/roles.guard';
import { ZodValidationPipe } from '../pipes/zod-validation-pipe';

@ApiTags('results')
@ApiBearerAuth('api-bearer')
@Controller('/api/results/seasons')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin')
export class ResultSeasonsController {
  constructor(
    private readonly listResultSeasons: ListResultSeasonsUseCase,
    private readonly getResultSeasonOverview: GetResultSeasonOverviewUseCase,
    private readonly getStudentSeasonComposition: GetStudentSeasonCompositionUseCase,
    private readonly createResultSeason: CreateResultSeasonUseCase,
    private readonly updateResultSeason: UpdateResultSeasonUseCase,
  ) {}

  @Get()
  @Permissions('results:read')
  async index(
    @Query(new ZodValidationPipe(resultSeasonsQuerySchema))
    query: ResultSeasonsQueryDto,
  ) {
    const { seasons, meta } = await this.listResultSeasons.execute(query);
    return { data: seasons, meta };
  }

  @Get(':id/overview')
  @Permissions('results:read')
  async overview(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query(new ZodValidationPipe(resultSeasonOverviewQuerySchema))
    query: ResultSeasonOverviewQueryDto,
  ) {
    return { data: await this.getResultSeasonOverview.execute(id, query) };
  }

  @Get(':id/student-composition')
  @Permissions('results:read')
  async studentComposition(@Param('id', new ParseUUIDPipe()) id: string) {
    return { data: await this.getStudentSeasonComposition.execute(id) };
  }

  @Post()
  @Permissions('results:write')
  async create(
    @Body(new ZodValidationPipe(createResultSeasonSchema))
    body: CreateResultSeasonDto,
  ) {
    const { season } = await this.createResultSeason.execute(body);
    return { data: season };
  }

  @Put(':id')
  @Permissions('results:write')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateResultSeasonSchema))
    body: UpdateResultSeasonDto,
  ) {
    const { season } = await this.updateResultSeason.execute(id, body);
    return { data: season };
  }
}
