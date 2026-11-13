import {
  Controller,
  Get,
  Body,
  Put,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard';
import { CurrentUser } from '@/infra/auth/current-user.decorator';
import type { AuthUser } from '@/infra/auth/auth.types';
import { Permissions } from '@/infra/auth/permissions.decorator';
import { PermissionsGuard } from '@/infra/auth/permissions.guard';
import { Roles } from '@/infra/auth/roles.decorator';
import { RolesGuard } from '@/infra/auth/roles.guard';
import {
  studentProgressReportQuerySchema,
  saveStudentProgressObservationSchema,
  type SaveStudentProgressObservationDto,
  type StudentProgressReportQuery,
} from '@/shared/contracts/student-progress-report';
import { ZodValidationPipe } from '../pipes/zod-validation-pipe';
import { StudentProgressReportService } from '../services/student-progress-report.service';

@ApiTags('student-progress-report')
@ApiBearerAuth('api-bearer')
@Controller('/api/students/:id/progress-report')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin', 'teacher')
export class StudentProgressReportController {
  constructor(private readonly reports: StudentProgressReportService) {}

  @Get()
  @Permissions('students:read')
  async show(
    @Param('id', new ParseUUIDPipe()) studentId: string,
    @Query(new ZodValidationPipe(studentProgressReportQuerySchema))
    query: StudentProgressReportQuery,
    @CurrentUser() user: AuthUser,
  ) {
    return { data: await this.reports.get(studentId, query, user) };
  }
  @Put('observation')
  // Teachers don't have general students:write. The service enforces an
  // independent student+teacher scope before touching the observation.
  @Permissions('students:read')
  async saveObservation(
    @Param('id', new ParseUUIDPipe()) studentId: string,
    @Body(new ZodValidationPipe(saveStudentProgressObservationSchema))
    body: SaveStudentProgressObservationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return {
      data: await this.reports.saveObservation(studentId, body, user),
    };
  }
}
