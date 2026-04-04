import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { createStudentSchema, updateStudentSchema, type CreateStudentDto, type UpdateStudentDto } from '@/shared/contracts/students.contracts'
import { CreateStudentUseCase } from '@/domain/students/application/use-cases/create-student'
import { DeleteStudentUseCase } from '@/domain/students/application/use-cases/delete-student'
import { ListStudentsUseCase } from '@/domain/students/application/use-cases/list-students'
import { UpdateStudentUseCase } from '@/domain/students/application/use-cases/update-student'
import { normalizePaginationParams } from '@/domain/shared/pagination/pagination-utils'
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard'
import { Roles } from '@/infra/auth/roles.decorator'
import { RolesGuard } from '@/infra/auth/roles.guard'
import { studentsListQuerySchema, type StudentsListQuery } from '../queries/list-query-schemas'
import { ZodValidationPipe } from '../pipes/zod-validation-pipe'
import { StudentRequestMapper } from '../mappers/student-request.mapper'
import { StudentPresenter } from '../presenters/student.presenter'

@ApiTags('students')
@ApiBearerAuth('supabase-bearer')
@Controller('/api/students')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'teacher')
export class StudentsController {
  constructor(
    private readonly listStudents: ListStudentsUseCase,
    private readonly createStudent: CreateStudentUseCase,
    private readonly updateStudent: UpdateStudentUseCase,
    private readonly deleteStudent: DeleteStudentUseCase,
  ) {}

  @Get()
  async index(@Query(new ZodValidationPipe(studentsListQuerySchema)) query: StudentsListQuery) {
    const { students, meta } = await this.listStudents.execute(
      {
        ...normalizePaginationParams({ page: query.page, perPage: query.perPage }),
        search: query.search,
        category: query.category,
        status: query.status,
      },
    )
    return { data: students.map(StudentPresenter.toHTTP), meta }
  }

  @Post()
  async create(@Body(new ZodValidationPipe(createStudentSchema)) body: CreateStudentDto) {
    const { student } = await this.createStudent.execute(StudentRequestMapper.toCreate(body))
    return { data: StudentPresenter.toHTTP(student) }
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body(new ZodValidationPipe(updateStudentSchema)) body: UpdateStudentDto) {
    const { student } = await this.updateStudent.execute(id, StudentRequestMapper.toUpdate(body))
    return { data: StudentPresenter.toHTTP(student) }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const { student } = await this.deleteStudent.execute(id)
    return { data: StudentPresenter.toHTTP(student) }
  }
}
