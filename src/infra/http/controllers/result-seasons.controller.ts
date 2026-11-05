import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  resultSeasonsQuerySchema,
  type ResultSeasonsQueryDto,
} from '@/shared/contracts/management';
import { ListResultSeasonsUseCase } from '@/domain/results/application/use-cases/list-result-seasons';
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
  constructor(private readonly listResultSeasons: ListResultSeasonsUseCase) {}

  @Get()
  @Permissions('results:read')
  async index(
    @Query(new ZodValidationPipe(resultSeasonsQuerySchema))
    query: ResultSeasonsQueryDto,
  ) {
    const { seasons, meta } = await this.listResultSeasons.execute(query);
    return { data: seasons, meta };
  }
}
