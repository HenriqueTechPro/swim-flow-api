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
  createTeacherSchema,
  updateTeacherSchema,
  type CreateTeacherDto,
  type UpdateTeacherDto,
} from '@/shared/contracts/management';
import { CreateTeacherUseCase } from '@/domain/teachers/application/use-cases/create-teacher';
import { DeleteTeacherUseCase } from '@/domain/teachers/application/use-cases/delete-teacher';
import { ListTeachersUseCase } from '@/domain/teachers/application/use-cases/list-teachers';
import { UpdateTeacherUseCase } from '@/domain/teachers/application/use-cases/update-teacher';
import { normalizePaginationParams } from '@/domain/shared/pagination/pagination-utils';
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard';
import { Permissions } from '@/infra/auth/permissions.decorator';
import { PermissionsGuard } from '@/infra/auth/permissions.guard';
import { Roles } from '@/infra/auth/roles.decorator';
import { RolesGuard } from '@/infra/auth/roles.guard';
import { ZodValidationPipe } from '../pipes/zod-validation-pipe';
import { TeacherRequestMapper } from '../mappers/teacher-request.mapper';
import { TeacherPresenter } from '../presenters/teacher.presenter';

@ApiTags('teachers')
@ApiBearerAuth('api-bearer')
@Controller('/api/teachers')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin', 'teacher')
export class TeachersController {
  constructor(
    private readonly listTeachers: ListTeachersUseCase,
    private readonly createTeacher: CreateTeacherUseCase,
    private readonly updateTeacher: UpdateTeacherUseCase,
    private readonly deleteTeacher: DeleteTeacherUseCase,
  ) {}

  @Get()
  @Permissions('teachers:read')
  async index(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    const { teachers, meta } = await this.listTeachers.execute({
      ...normalizePaginationParams({
        page: Number(page),
        perPage: Number(perPage),
      }),
      search,
      status: status && status !== 'all' ? status : undefined,
    });
    return { data: teachers.map(TeacherPresenter.toHTTP), meta };
  }

  @Post()
  @Permissions('teachers:write')
  async create(
    @Body(new ZodValidationPipe(createTeacherSchema)) body: CreateTeacherDto,
  ) {
    const { teacher } = await this.createTeacher.execute(
      TeacherRequestMapper.toCreate(body),
    );
    return { data: TeacherPresenter.toHTTP(teacher) };
  }

  @Put(':id')
  @Permissions('teachers:write')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateTeacherSchema)) body: UpdateTeacherDto,
  ) {
    const { teacher } = await this.updateTeacher.execute(
      id,
      TeacherRequestMapper.toUpdate(body),
    );
    return { data: TeacherPresenter.toHTTP(teacher) };
  }

  @Delete(':id')
  @Permissions('teachers:write')
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    const { teacher } = await this.deleteTeacher.execute(id);
    return { data: TeacherPresenter.toHTTP(teacher) };
  }
}
