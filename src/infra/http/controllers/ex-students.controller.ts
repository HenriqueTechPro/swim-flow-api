import {
  BadRequestException,
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
  createExStudentSchema,
  reactivateExStudentSchema,
  updateExStudentSchema,
  type CreateExStudentDto,
  type ReactivateExStudentDto,
  type UpdateExStudentDto,
} from '@/shared/contracts/management';
import { CreateExStudentUseCase } from '@/domain/ex-students/application/use-cases/create-ex-student';
import { DeleteExStudentUseCase } from '@/domain/ex-students/application/use-cases/delete-ex-student';
import { GetExStudentsSummaryUseCase } from '@/domain/ex-students/application/use-cases/get-ex-students-summary';
import { ListExStudentsUseCase } from '@/domain/ex-students/application/use-cases/list-ex-students';
import { ReactivateExStudentUseCase } from '@/domain/ex-students/application/use-cases/reactivate-ex-student';
import { UpdateExStudentUseCase } from '@/domain/ex-students/application/use-cases/update-ex-student';
import { normalizePaginationParams } from '@/domain/shared/pagination/pagination-utils';
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard';
import { Permissions } from '@/infra/auth/permissions.decorator';
import { PermissionsGuard } from '@/infra/auth/permissions.guard';
import { Roles } from '@/infra/auth/roles.decorator';
import { RolesGuard } from '@/infra/auth/roles.guard';
import { ZodValidationPipe } from '../pipes/zod-validation-pipe';
import { ExStudentRequestMapper } from '../mappers/ex-student-request.mapper';
import { ExStudentPresenter } from '../presenters/ex-student.presenter';

@ApiTags('ex-students')
@ApiBearerAuth('api-bearer')
@Controller('/api/ex-students')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin', 'teacher')
export class ExStudentsController {
  constructor(
    private readonly getExStudentsSummary: GetExStudentsSummaryUseCase,
    private readonly listExStudents: ListExStudentsUseCase,
    private readonly createExStudent: CreateExStudentUseCase,
    private readonly updateExStudent: UpdateExStudentUseCase,
    private readonly deleteExStudent: DeleteExStudentUseCase,
    private readonly reactivateExStudent: ReactivateExStudentUseCase,
  ) {}

  @Get('summary')
  @Permissions('ex-students:read')
  async summary() {
    const { summary } = await this.getExStudentsSummary.execute();
    return { data: summary };
  }

  @Get()
  @Permissions('ex-students:read')
  async index(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
  ) {
    const pagination = normalizePaginationParams({
      page: Number(page),
      perPage: Number(perPage),
    });
    const { exStudents, meta } = await this.listExStudents.execute({
      page: pagination.page,
      perPage: pagination.perPage,
      search,
      category,
    });
    return { data: exStudents.map(ExStudentPresenter.toHTTP), meta };
  }

  @Post()
  @Permissions('ex-students:write')
  async create(
    @Body(new ZodValidationPipe(createExStudentSchema))
    body: CreateExStudentDto,
  ) {
    const { exStudent } = await this.createExStudent.execute(
      ExStudentRequestMapper.toCreate(body),
    );
    return { data: ExStudentPresenter.toHTTP(exStudent) };
  }

  @Put(':id')
  @Permissions('ex-students:write')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateExStudentSchema))
    body: UpdateExStudentDto,
  ) {
    const { exStudent } = await this.updateExStudent.execute(
      id,
      ExStudentRequestMapper.toUpdate(body),
    );
    return { data: ExStudentPresenter.toHTTP(exStudent) };
  }

  @Post(':id/reactivate')
  @Permissions('ex-students:write')
  async reactivate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(reactivateExStudentSchema))
    body: ReactivateExStudentDto,
  ) {
    if (body.id !== id) {
      throw new BadRequestException('Route id must match payload id');
    }
    const { exStudent } = await this.reactivateExStudent.execute(id);
    return { data: ExStudentPresenter.toHTTP(exStudent) };
  }

  @Delete(':id')
  @Permissions('ex-students:write')
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    const { exStudent } = await this.deleteExStudent.execute(id);
    return { data: ExStudentPresenter.toHTTP(exStudent) };
  }
}
