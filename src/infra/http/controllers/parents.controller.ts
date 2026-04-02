import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { createParentSchema, updateParentSchema, type CreateParentDto, type UpdateParentDto } from '@/shared/contracts/management'
import { CreateParentUseCase } from '@/domain/parents/application/use-cases/create-parent'
import { DeleteParentUseCase } from '@/domain/parents/application/use-cases/delete-parent'
import { ListParentsUseCase } from '@/domain/parents/application/use-cases/list-parents'
import { UpdateParentUseCase } from '@/domain/parents/application/use-cases/update-parent'
import { normalizePaginationParams } from '@/domain/shared/pagination/pagination-utils'
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard'
import { Roles } from '@/infra/auth/roles.decorator'
import { RolesGuard } from '@/infra/auth/roles.guard'
import { ZodValidationPipe } from '../pipes/zod-validation-pipe'
import { ParentRequestMapper } from '../mappers/parent-request.mapper'
import { ParentPresenter } from '../presenters/parent.presenter'

@ApiTags('parents')
@ApiBearerAuth('supabase-bearer')
@Controller('/api/parents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'teacher')
export class ParentsController {
  constructor(
    private readonly listParents: ListParentsUseCase,
    private readonly createParent: CreateParentUseCase,
    private readonly updateParent: UpdateParentUseCase,
    private readonly deleteParent: DeleteParentUseCase,
  ) {}

  @Get()
  async index(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    const { parents, meta } = await this.listParents.execute({
      ...normalizePaginationParams({ page: Number(page), perPage: Number(perPage) }),
      search,
      status,
    })
    return { data: parents.map(ParentPresenter.toHTTP), meta }
  }

  @Post()
  async create(@Body(new ZodValidationPipe(createParentSchema)) body: CreateParentDto) {
    const { parent } = await this.createParent.execute(ParentRequestMapper.toCreate(body))
    return { data: ParentPresenter.toHTTP(parent) }
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body(new ZodValidationPipe(updateParentSchema)) body: UpdateParentDto) {
    const { parent } = await this.updateParent.execute(id, ParentRequestMapper.toUpdate(body))
    return { data: ParentPresenter.toHTTP(parent) }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const { parent } = await this.deleteParent.execute(id)
    return { data: ParentPresenter.toHTTP(parent) }
  }
}
