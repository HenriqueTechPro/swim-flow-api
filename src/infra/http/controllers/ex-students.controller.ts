import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import {
  createExStudentSchema,
  reactivateExStudentSchema,
  updateExStudentSchema,
  type CreateExStudentDto,
  type ReactivateExStudentDto,
  type UpdateExStudentDto,
} from '@/shared/contracts/management'
import { CreateExStudentUseCase } from '@/domain/ex-students/application/use-cases/create-ex-student'
import { DeleteExStudentUseCase } from '@/domain/ex-students/application/use-cases/delete-ex-student'
import { ListExStudentsUseCase } from '@/domain/ex-students/application/use-cases/list-ex-students'
import { ReactivateExStudentUseCase } from '@/domain/ex-students/application/use-cases/reactivate-ex-student'
import { UpdateExStudentUseCase } from '@/domain/ex-students/application/use-cases/update-ex-student'
import { normalizePaginationParams } from '@/domain/shared/pagination/pagination-utils'
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard'
import { Roles } from '@/infra/auth/roles.decorator'
import { RolesGuard } from '@/infra/auth/roles.guard'
import { ZodValidationPipe } from '../pipes/zod-validation-pipe'
import { ExStudentRequestMapper } from '../mappers/ex-student-request.mapper'
import { ExStudentPresenter } from '../presenters/ex-student.presenter'

@ApiTags('ex-students')
@ApiBearerAuth('supabase-bearer')
@Controller('/api/ex-students')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'teacher')
export class ExStudentsController {
  constructor(
    private readonly listExStudents: ListExStudentsUseCase,
    private readonly createExStudent: CreateExStudentUseCase,
    private readonly updateExStudent: UpdateExStudentUseCase,
    private readonly deleteExStudent: DeleteExStudentUseCase,
    private readonly reactivateExStudent: ReactivateExStudentUseCase,
  ) {}

  @Get()
  async index(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
  ) {
    const pagination = normalizePaginationParams({ page: Number(page), perPage: Number(perPage) })
    const { exStudents, meta } = await this.listExStudents.execute({
      page: pagination.page,
      perPage: pagination.perPage,
      search,
      category,
    })
    return { data: exStudents.map(ExStudentPresenter.toHTTP), meta }
  }

  @Post()
  async create(@Body(new ZodValidationPipe(createExStudentSchema)) body: CreateExStudentDto) {
    const { exStudent } = await this.createExStudent.execute(ExStudentRequestMapper.toCreate(body))
    return { data: ExStudentPresenter.toHTTP(exStudent) }
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body(new ZodValidationPipe(updateExStudentSchema)) body: UpdateExStudentDto) {
    const { exStudent } = await this.updateExStudent.execute(id, ExStudentRequestMapper.toUpdate(body))
    return { data: ExStudentPresenter.toHTTP(exStudent) }
  }

  @Post(':id/reactivate')
  async reactivate(@Param('id') id: string, @Body(new ZodValidationPipe(reactivateExStudentSchema)) _body: ReactivateExStudentDto) {
    const { exStudent } = await this.reactivateExStudent.execute(id)
    return { data: ExStudentPresenter.toHTTP(exStudent) }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const { exStudent } = await this.deleteExStudent.execute(id)
    return { data: ExStudentPresenter.toHTTP(exStudent) }
  }
}
