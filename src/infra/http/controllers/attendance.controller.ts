import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ListAttendanceRecordsUseCase } from '@/domain/attendance/application/use-cases/list-attendance-records'
import { SaveAttendanceBatchUseCase } from '@/domain/attendance/application/use-cases/save-attendance-batch'
import { normalizePaginationParams } from '@/domain/shared/pagination/pagination-utils'
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard'
import { Roles } from '@/infra/auth/roles.decorator'
import { RolesGuard } from '@/infra/auth/roles.guard'
import { saveAttendanceBatchSchema, type SaveAttendanceBatchDto } from '@/shared/contracts/attendance.contracts'
import { AttendanceRequestMapper } from '../mappers/attendance-request.mapper'
import { attendanceListQuerySchema, type AttendanceListQuery } from '../queries/list-query-schemas'
import { ZodValidationPipe } from '../pipes/zod-validation-pipe'
import { AttendanceRecordPresenter } from '../presenters/attendance-record.presenter'

@ApiTags('attendance')
@ApiBearerAuth('supabase-bearer')
@Controller('/api/attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'teacher')
export class AttendanceController {
  constructor(
    private readonly listAttendanceRecords: ListAttendanceRecordsUseCase,
    private readonly saveAttendanceBatch: SaveAttendanceBatchUseCase,
  ) {}

  @Get()
  async index(@Query(new ZodValidationPipe(attendanceListQuerySchema)) query: AttendanceListQuery) {
    const pagination = normalizePaginationParams({ page: query.page, perPage: query.perPage })

    const { items, total, page: currentPage, perPage: currentPerPage } = await this.listAttendanceRecords.execute({
      page: pagination.page,
      perPage: pagination.perPage,
      search: query.search,
      startDate: query.startDate,
      endDate: query.endDate,
      classId: query.classId,
      studentId: query.studentId,
      status: query.status,
    })

    return {
      data: items.map(AttendanceRecordPresenter.toHTTP),
      meta: {
        page: currentPage,
        perPage: currentPerPage,
        total,
      },
    }
  }

  @Post()
  async save(@Body(new ZodValidationPipe(saveAttendanceBatchSchema)) body: SaveAttendanceBatchDto) {
    const { records } = await this.saveAttendanceBatch.execute(AttendanceRequestMapper.toSaveBatch(body))
    return { data: records.map(AttendanceRecordPresenter.toHTTP) }
  }
}
