import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CompetitionProgramRepository } from '@/domain/competition-program/application/repositories/competition-program-repository';
import {
  createOpenWaterProgramRaceSchema,
  createOpenWaterProgramStartSchema,
  createPoolProgramHeatSchema,
  createPoolProgramRaceSchema,
  programRaceListSchema,
  programSeriesListSchema,
  type CreateOpenWaterProgramRaceDto,
  type CreateOpenWaterProgramStartDto,
  type CreatePoolProgramHeatDto,
  type CreatePoolProgramRaceDto,
  type ProgramRaceListDto,
  type ProgramSeriesListDto,
} from '@/shared/contracts/competition-program';
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard';
import { Permissions } from '@/infra/auth/permissions.decorator';
import { PermissionsGuard } from '@/infra/auth/permissions.guard';
import { Roles } from '@/infra/auth/roles.decorator';
import { RolesGuard } from '@/infra/auth/roles.guard';
import { ZodValidationPipe } from '../pipes/zod-validation-pipe';

const toResponse = <T>(result: { items: T[]; total: number; page: number; perPage: number }) => ({
  data: result.items,
  meta: { total: result.total, page: result.page, perPage: result.perPage },
});

@ApiTags('competition-program')
@ApiBearerAuth('api-bearer')
@Controller('/api/competition-program')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin')
export class CompetitionProgramController {
  constructor(private readonly program: CompetitionProgramRepository) {}

  @Get('pool/races')
  @Permissions('events:read')
  async poolRaces(
    @Query(new ZodValidationPipe(programRaceListSchema)) input: ProgramRaceListDto,
  ) {
    return toResponse(await this.program.listPoolRaces(input));
  }

  @Post('pool/races')
  @Permissions('events:write')
  async createPoolRace(
    @Body(new ZodValidationPipe(createPoolProgramRaceSchema))
    input: CreatePoolProgramRaceDto,
  ) {
    return { data: await this.program.createPoolRace(input) };
  }

  @Get('pool/heats')
  @Permissions('events:read')
  async poolHeats(
    @Query(new ZodValidationPipe(programSeriesListSchema)) input: ProgramSeriesListDto,
  ) {
    return toResponse(await this.program.listPoolHeats(input));
  }

  @Post('pool/heats')
  @Permissions('events:write')
  async createPoolHeat(
    @Body(new ZodValidationPipe(createPoolProgramHeatSchema))
    input: CreatePoolProgramHeatDto,
  ) {
    return { data: await this.program.createPoolHeat(input) };
  }

  @Get('open-water/races')
  @Permissions('events:read')
  async openWaterRaces(
    @Query(new ZodValidationPipe(programRaceListSchema)) input: ProgramRaceListDto,
  ) {
    return toResponse(await this.program.listOpenWaterRaces(input));
  }

  @Post('open-water/races')
  @Permissions('events:write')
  async createOpenWaterRace(
    @Body(new ZodValidationPipe(createOpenWaterProgramRaceSchema))
    input: CreateOpenWaterProgramRaceDto,
  ) {
    return { data: await this.program.createOpenWaterRace(input) };
  }

  @Get('open-water/starts')
  @Permissions('events:read')
  async openWaterStarts(
    @Query(new ZodValidationPipe(programSeriesListSchema)) input: ProgramSeriesListDto,
  ) {
    return toResponse(await this.program.listOpenWaterStarts(input));
  }

  @Post('open-water/starts')
  @Permissions('events:write')
  async createOpenWaterStart(
    @Body(new ZodValidationPipe(createOpenWaterProgramStartSchema))
    input: CreateOpenWaterProgramStartDto,
  ) {
    return { data: await this.program.createOpenWaterStart(input) };
  }
}
