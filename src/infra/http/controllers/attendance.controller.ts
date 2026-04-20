import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ListAttendanceRecordsUseCase } from '@/domain/attendance/application/use-cases/list-attendance-records';
import { GetAttendanceSummaryUseCase } from '@/domain/attendance/application/use-cases/get-attendance-summary';
import { SaveAttendanceBatchUseCase } from '@/domain/attendance/application/use-cases/save-attendance-batch';
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard';
import { Permissions } from '@/infra/auth/permissions.decorator';
import { PermissionsGuard } from '@/infra/auth/permissions.guard';
import { Roles } from '@/infra/auth/roles.decorator';
import { RolesGuard } from '@/infra/auth/roles.guard';
import {
  saveAttendanceBatchSchema,
  type SaveAttendanceBatchDto,
} from '@/shared/contracts/management';
import { AttendanceRequestMapper } from '../mappers/attendance-request.mapper';
import { ZodValidationPipe } from '../pipes/zod-validation-pipe';
import { AttendanceRecordPresenter } from '../presenters/attendance-record.presenter';
import { AttendanceSummaryPresenter } from '../presenters/attendance-summary.presenter';
import { normalizePaginationParams } from '@/domain/shared/pagination/pagination-utils';

@ApiTags('attendance')
@ApiBearerAuth('api-bearer')
@Controller('/api/attendance')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin', 'teacher')
export class AttendanceController {
  constructor(
    private readonly listAttendanceRecords: ListAttendanceRecordsUseCase,
    private readonly getAttendanceSummary: GetAttendanceSummaryUseCase,
    private readonly saveAttendanceBatch: SaveAttendanceBatchUseCase,
  ) {}

  @Get('summary')
  @Permissions('attendance:read')
  async summary(
    @Query('date') date?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('classId') classId?: string,
    @Query('studentId') studentId?: string,
  ) {
    const summary = await this.getAttendanceSummary.execute({
      date,
      startDate,
      endDate,
      classId,
      studentId,
    });

    return { data: AttendanceSummaryPresenter.toHTTP(summary) };
  }

  @Get()
  @Permissions('attendance:read')
  async index(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('classId') classId?: string,
    @Query('studentId') studentId?: string,
    @Query('status') status?: string,
  ) {
    const pagination = normalizePaginationParams({
      page: Number(page),
      perPage: Number(perPage),
    });

    const {
      items,
      total,
      page: currentPage,
      perPage: currentPerPage,
    } = await this.listAttendanceRecords.execute({
      page: pagination.page,
      perPage: pagination.perPage,
      search,
      startDate,
      endDate,
      classId,
      studentId,
      status,
    });

    return {
      data: items.map(AttendanceRecordPresenter.toHTTP),
      meta: {
        page: currentPage,
        perPage: currentPerPage,
        total,
      },
    };
  }

  @Post()
  @Permissions('attendance:write')
  async save(
    @Body(new ZodValidationPipe(saveAttendanceBatchSchema))
    body: SaveAttendanceBatchDto,
  ) {
    const { records } = await this.saveAttendanceBatch.execute(
      AttendanceRequestMapper.toSaveBatch(body),
    );
    return { data: records.map(AttendanceRecordPresenter.toHTTP) };
  }
}

