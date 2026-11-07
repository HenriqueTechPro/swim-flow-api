import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createStudentPhysicalAssessmentSchema,
  type CreateStudentPhysicalAssessmentDto,
} from '@/shared/contracts/student-physical-assessments';
import { CreateStudentPhysicalAssessmentUseCase } from '@/domain/assessments/application/use-cases/create-student-physical-assessment';
import { ListStudentPhysicalAssessmentsUseCase } from '@/domain/assessments/application/use-cases/list-student-physical-assessments';
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard';
import { Permissions } from '@/infra/auth/permissions.decorator';
import { PermissionsGuard } from '@/infra/auth/permissions.guard';
import { Roles } from '@/infra/auth/roles.decorator';
import { RolesGuard } from '@/infra/auth/roles.guard';
import { ZodValidationPipe } from '../pipes/zod-validation-pipe';

@ApiTags('student-physical-assessments')
@ApiBearerAuth('api-bearer')
@Controller('/api/students/:id/physical-assessments')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin')
export class StudentPhysicalAssessmentsController {
  constructor(
    private readonly listAssessments: ListStudentPhysicalAssessmentsUseCase,
    private readonly createAssessment: CreateStudentPhysicalAssessmentUseCase,
  ) {}

  @Get()
  @Permissions('students:read')
  async list(@Param('id', new ParseUUIDPipe()) studentId: string) {
    return { data: await this.listAssessments.execute(studentId) };
  }

  @Post()
  @Permissions('students:write')
  async create(
    @Param('id', new ParseUUIDPipe()) studentId: string,
    @Body(new ZodValidationPipe(createStudentPhysicalAssessmentSchema))
    body: CreateStudentPhysicalAssessmentDto,
  ) {
    return { data: await this.createAssessment.execute(studentId, body) };
  }
}
