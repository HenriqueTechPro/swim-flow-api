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
  type CreateTeacherDto,
  type UpdateTeacherDto,
} from '@/shared/contracts/management';
import {
  createTeacherRequestSchema,
  updateTeacherRequestSchema,
} from '@/shared/contracts/cpf-management-requests';
import { CreateTeacherUseCase } from '@/domain/teachers/application/use-cases/create-teacher';
import { DeleteTeacherUseCase } from '@/domain/teachers/application/use-cases/delete-teacher';
import { GetTeacherUseCase } from '@/domain/teachers/application/use-cases/get-teacher';
import { ListTeachersUseCase } from '@/domain/teachers/application/use-cases/list-teachers';
import { GetTeacherAccountLinkUseCase } from '@/domain/teachers/application/use-cases/get-teacher-account-link';
import { LinkTeacherAccountUseCase } from '@/domain/teachers/application/use-cases/link-teacher-account';
import { UnlinkTeacherAccountUseCase } from '@/domain/teachers/application/use-cases/unlink-teacher-account';
import {
  linkTeacherAccountSchema,
  type LinkTeacherAccountDto,
} from '@/shared/contracts/teacher-accounts';
import { CurrentUser } from '@/infra/auth/current-user.decorator';
import type { AuthUser } from '@/infra/auth/auth.types';
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
@Roles('admin')
export class TeachersController {
  constructor(
    private readonly listTeachers: ListTeachersUseCase,
    private readonly getTeacher: GetTeacherUseCase,
    private readonly createTeacher: CreateTeacherUseCase,
    private readonly updateTeacher: UpdateTeacherUseCase,
    private readonly deleteTeacher: DeleteTeacherUseCase,
    private readonly getTeacherAccountLink: GetTeacherAccountLinkUseCase,
    private readonly linkTeacherAccount: LinkTeacherAccountUseCase,
    private readonly unlinkTeacherAccount: UnlinkTeacherAccountUseCase,
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

  @Get(':id')
  @Permissions('teachers:read')
  async show(
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const { teacher } = await this.getTeacher.execute(id);
    return { data: TeacherPresenter.toHTTP(teacher) };
  }

  @Post()
  @Permissions('teachers:write')
  async create(
    @Body(new ZodValidationPipe(createTeacherRequestSchema))
    body: CreateTeacherDto,
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
    @Body(new ZodValidationPipe(updateTeacherRequestSchema))
    body: UpdateTeacherDto,
  ) {
    const { teacher } = await this.updateTeacher.execute(
      id,
      TeacherRequestMapper.toUpdate(body),
    );
    return { data: TeacherPresenter.toHTTP(teacher) };
  }

  @Get(':id/account')
  @Permissions('teachers:read')
  async account(@Param('id', new ParseUUIDPipe()) id: string) {
    return { data: await this.getTeacherAccountLink.execute(id) };
  }

  @Put(':id/account')
  @Permissions('teachers:write')
  async linkAccount(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(linkTeacherAccountSchema))
    body: LinkTeacherAccountDto,
  ) {
    return {
      data: await this.linkTeacherAccount.execute({
        teacherId: id,
        profileId: body.profileId,
        actorProfileId: user.id,
      }),
    };
  }

  @Delete(':id/account')
  @Permissions('teachers:write')
  async unlinkAccount(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return {
      data: await this.unlinkTeacherAccount.execute({
        teacherId: id,
        actorProfileId: user.id,
      }),
    };
  }

  @Delete(':id')
  @Permissions('teachers:write')
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    const { teacher } = await this.deleteTeacher.execute(id);
    return { data: TeacherPresenter.toHTTP(teacher) };
  }
}
