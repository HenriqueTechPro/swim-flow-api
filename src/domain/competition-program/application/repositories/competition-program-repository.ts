import type { PaginatedResult } from '@/domain/shared/pagination/pagination-params';
import type {
  CreatePoolProgramRaceDto,
  CreateOpenWaterProgramRaceDto,
  CreatePoolProgramHeatDto,
  CreateOpenWaterProgramStartDto,
  ProgramRaceListDto,
  ProgramSeriesListDto,
} from '@/shared/contracts/competition-program';

export interface PoolProgramRaceRecord extends CreatePoolProgramRaceDto {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OpenWaterProgramRaceRecord extends CreateOpenWaterProgramRaceDto {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PoolProgramHeatRecord {
  id: string;
  raceId: string;
  heatNumber: number;
  plannedStartAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OpenWaterProgramStartRecord {
  id: string;
  raceId: string;
  waveNumber: number;
  plannedStartAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export abstract class CompetitionProgramRepository {
  abstract createPoolRace(input: CreatePoolProgramRaceDto): Promise<PoolProgramRaceRecord>;
  abstract listPoolRaces(input: ProgramRaceListDto): Promise<PaginatedResult<PoolProgramRaceRecord>>;
  abstract createPoolHeat(input: CreatePoolProgramHeatDto): Promise<PoolProgramHeatRecord>;
  abstract listPoolHeats(input: ProgramSeriesListDto): Promise<PaginatedResult<PoolProgramHeatRecord>>;

  abstract createOpenWaterRace(input: CreateOpenWaterProgramRaceDto): Promise<OpenWaterProgramRaceRecord>;
  abstract listOpenWaterRaces(input: ProgramRaceListDto): Promise<PaginatedResult<OpenWaterProgramRaceRecord>>;
  abstract createOpenWaterStart(input: CreateOpenWaterProgramStartDto): Promise<OpenWaterProgramStartRecord>;
  abstract listOpenWaterStarts(input: ProgramSeriesListDto): Promise<PaginatedResult<OpenWaterProgramStartRecord>>;
}
