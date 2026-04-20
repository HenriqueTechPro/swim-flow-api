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
  createStudentSchema,
  updateStudentSchema,
  type CreateStudentDto,
  type UpdateStudentDto,
} from '@/shared/contracts/management';
import { CreateStudentUseCase } from '@/domain/students/application/use-cases/create-student';
import { DeleteStudentUseCase } from '@/domain/students/application/use-cases/delete-student';
import { ListStudentReferenceDataUseCase } from '@/domain/students/application/use-cases/list-student-reference-data';
import { ListStudentsUseCase } from '@/domain/students/application/use-cases/list-students';
import { UpdateStudentUseCase } from '@/domain/students/application/use-cases/update-student';
import { normalizePaginationParams } from '@/domain/shared/pagination/pagination-utils';
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard';
import { Permissions } from '@/infra/auth/permissions.decorator';
import { PermissionsGuard } from '@/infra/auth/permissions.guard';
import { Roles } from '@/infra/auth/roles.decorator';
import { RolesGuard } from '@/infra/auth/roles.guard';
import { ZodValidationPipe } from '../pipes/zod-validation-pipe';
import { StudentRequestMapper } from '../mappers/student-request.mapper';
import { StudentPresenter } from '../presenters/student.presenter';

@ApiTags('students')
@ApiBearerAuth('api-bearer')
@Controller('/api/students')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin', 'teacher')
export class StudentsController {
  constructor(
    private readonly listStudents: ListStudentsUseCase,
    private readonly listStudentReferenceData: ListStudentReferenceDataUseCase,
    private readonly createStudent: CreateStudentUseCase,
    private readonly updateStudent: UpdateStudentUseCase,
    private readonly deleteStudent: DeleteStudentUseCase,
  ) {}

  @Get('reference-data')
  @Permissions('students:read')
  async referenceData() {
    return {
      data: await this.listStudentReferenceData.execute(),
    };
  }

  @Get()
  @Permissions('students:read')
  async index(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
  ) {
    const { students, meta } = await this.listStudents.execute({
      ...normalizePaginationParams({
        page: Number(page),
        perPage: Number(perPage),
      }),
      search,
      category: category && category !== 'all' ? category : undefined,
      status: status && status !== 'all' ? status : undefined,
    });
    return { data: students.map(StudentPresenter.toHTTP), meta };
  }

  @Post()
  @Permissions('students:write')
  async create(
    @Body(new ZodValidationPipe(createStudentSchema)) body: CreateStudentDto,
  ) {
    const { student } = await this.createStudent.execute(
      StudentRequestMapper.toCreate(body),
    );
    return { data: StudentPresenter.toHTTP(student) };
  }

  @Put(':id')
  @Permissions('students:write')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateStudentSchema)) body: UpdateStudentDto,
  ) {
    const { student } = await this.updateStudent.execute(
      id,
      StudentRequestMapper.toUpdate(body),
    );
    return { data: StudentPresenter.toHTTP(student) };
  }

  @Delete(':id')
  @Permissions('students:write')
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    const { student } = await this.deleteStudent.execute(id);
    return { data: StudentPresenter.toHTTP(student) };
  }
}
