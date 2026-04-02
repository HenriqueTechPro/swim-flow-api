import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import {
  assignClassTeacherSchema,
  createClassSchema,
  transferStudentSchema,
  transferTeacherSchema,
  updateClassSchema,
  updateClassTeacherRoleSchema,
  type AssignClassTeacherDto,
  type CreateClassDto,
  type TransferStudentDto,
  type TransferTeacherDto,
  type UpdateClassDto,
  type UpdateClassTeacherRoleDto,
} from '@/shared/contracts/management'
import { AddClassTeacherUseCase } from '@/domain/classes/application/use-cases/add-class-teacher'
import { CreateClassUseCase } from '@/domain/classes/application/use-cases/create-class'
import { DeleteClassUseCase } from '@/domain/classes/application/use-cases/delete-class'
import { ListClassesUseCase } from '@/domain/classes/application/use-cases/list-classes'
import { RemoveClassTeacherUseCase } from '@/domain/classes/application/use-cases/remove-class-teacher'
import { TransferClassTeacherUseCase } from '@/domain/classes/application/use-cases/transfer-class-teacher'
import { TransferClassStudentUseCase } from '@/domain/classes/application/use-cases/transfer-class-student'
import { UpdateClassUseCase } from '@/domain/classes/application/use-cases/update-class'
import { UpdateClassTeacherRoleUseCase } from '@/domain/classes/application/use-cases/update-class-teacher-role'
import { normalizePaginationParams } from '@/domain/shared/pagination/pagination-utils'
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard'
import { Roles } from '@/infra/auth/roles.decorator'
import { RolesGuard } from '@/infra/auth/roles.guard'
import { ZodValidationPipe } from '../pipes/zod-validation-pipe'
import { ClassRequestMapper } from '../mappers/class-request.mapper'
import { ClassPresenter } from '../presenters/class.presenter'

@ApiTags('classes')
@ApiBearerAuth('supabase-bearer')
@Controller('/api/classes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'teacher')
export class ClassesController {
  constructor(
    private readonly listClasses: ListClassesUseCase,
    private readonly createClass: CreateClassUseCase,
    private readonly updateClass: UpdateClassUseCase,
    private readonly addClassTeacher: AddClassTeacherUseCase,
    private readonly updateClassTeacherRole: UpdateClassTeacherRoleUseCase,
    private readonly removeClassTeacher: RemoveClassTeacherUseCase,
    private readonly transferClassTeacher: TransferClassTeacherUseCase,
    private readonly transferClassStudent: TransferClassStudentUseCase,
    private readonly deleteClass: DeleteClassUseCase,
  ) {}

  @Get()
  async index(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('day') day?: string,
    @Query('status') status?: string,
    @Query('poolId') poolId?: string,
  ) {
    const { classes, meta } = await this.listClasses.execute({
      ...normalizePaginationParams({ page: Number(page), perPage: Number(perPage) }),
      search,
      category,
      day,
      status,
      poolId,
    })
    return { data: classes.map(ClassPresenter.toHTTP), meta }
  }

  @Post()
  async create(@Body(new ZodValidationPipe(createClassSchema)) body: CreateClassDto) {
    const { classItem } = await this.createClass.execute(ClassRequestMapper.toCreate(body))
    return { data: ClassPresenter.toHTTP(classItem) }
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body(new ZodValidationPipe(updateClassSchema)) body: UpdateClassDto) {
    const { classItem } = await this.updateClass.execute(id, ClassRequestMapper.toUpdate(body))
    return { data: ClassPresenter.toHTTP(classItem) }
  }

  @Post(':id/teachers')
  async addTeacher(@Param('id') id: string, @Body(new ZodValidationPipe(assignClassTeacherSchema)) body: AssignClassTeacherDto) {
    const { classItem } = await this.addClassTeacher.execute(id, ClassRequestMapper.toAssignTeacher(body))
    return { data: ClassPresenter.toHTTP(classItem) }
  }

  @Patch(':id/teachers/:teacherId/role')
  async updateTeacherRole(
    @Param('id') id: string,
    @Param('teacherId') teacherId: string,
    @Body(new ZodValidationPipe(updateClassTeacherRoleSchema)) body: UpdateClassTeacherRoleDto,
  ) {
    const { classItem } = await this.updateClassTeacherRole.execute(
      id,
      teacherId,
      ClassRequestMapper.toUpdateTeacherRole(body),
    )
    return { data: ClassPresenter.toHTTP(classItem) }
  }

  @Delete(':id/teachers/:teacherId')
  async removeTeacher(@Param('id') id: string, @Param('teacherId') teacherId: string) {
    const { classItem } = await this.removeClassTeacher.execute(id, teacherId)
    return { data: ClassPresenter.toHTTP(classItem) }
  }

  @Post('teachers/transfer')
  async transferTeacher(@Body(new ZodValidationPipe(transferTeacherSchema)) body: TransferTeacherDto) {
    const { classItem } = await this.transferClassTeacher.execute(ClassRequestMapper.toTransferTeacher(body))
    return { data: ClassPresenter.toHTTP(classItem) }
  }

  @Post('students/transfer')
  async transferStudent(@Body(new ZodValidationPipe(transferStudentSchema)) body: TransferStudentDto) {
    const { classItem } = await this.transferClassStudent.execute(ClassRequestMapper.toTransferStudent(body))
    return { data: ClassPresenter.toHTTP(classItem) }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const { classItem } = await this.deleteClass.execute(id)
    return { data: ClassPresenter.toHTTP(classItem) }
  }
}
