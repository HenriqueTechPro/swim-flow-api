import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { createPoolSchema, updatePoolSchema, type CreatePoolDto, type UpdatePoolDto } from '@/shared/contracts/management'
import { CreatePoolUseCase } from '@/domain/pools/application/use-cases/create-pool'
import { DeletePoolUseCase } from '@/domain/pools/application/use-cases/delete-pool'
import { ListPoolsUseCase } from '@/domain/pools/application/use-cases/list-pools'
import { UpdatePoolUseCase } from '@/domain/pools/application/use-cases/update-pool'
import { normalizePaginationParams } from '@/domain/shared/pagination/pagination-utils'
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard'
import { Roles } from '@/infra/auth/roles.decorator'
import { RolesGuard } from '@/infra/auth/roles.guard'
import { ZodValidationPipe } from '../pipes/zod-validation-pipe'
import { PoolRequestMapper } from '../mappers/pool-request.mapper'
import { PoolPresenter } from '../presenters/pool.presenter'

@ApiTags('pools')
@ApiBearerAuth('supabase-bearer')
@Controller('/api/pools')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'teacher')
export class PoolsController {
  constructor(
    private readonly listPools: ListPoolsUseCase,
    private readonly createPool: CreatePoolUseCase,
    private readonly updatePool: UpdatePoolUseCase,
    private readonly deletePool: DeletePoolUseCase,
  ) {}

  @Get()
  async index(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    const pagination = normalizePaginationParams({ page: Number(page), perPage: Number(perPage) })
    const { pools, meta } = await this.listPools.execute({
      page: pagination.page,
      perPage: pagination.perPage,
      search,
      status,
    })
    return { data: pools.map(PoolPresenter.toHTTP), meta }
  }

  @Post()
  async create(@Body(new ZodValidationPipe(createPoolSchema)) body: CreatePoolDto) {
    const { pool } = await this.createPool.execute(PoolRequestMapper.toCreate(body))
    return { data: PoolPresenter.toHTTP(pool) }
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body(new ZodValidationPipe(updatePoolSchema)) body: UpdatePoolDto) {
    const { pool } = await this.updatePool.execute(id, PoolRequestMapper.toUpdate(body))
    return { data: PoolPresenter.toHTTP(pool) }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const { pool } = await this.deletePool.execute(id)
    return { data: PoolPresenter.toHTTP(pool) }
  }
}
