import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { createEventSchema, updateEventSchema, type CreateEventDto, type UpdateEventDto } from '@/shared/contracts/events.contracts'
import { CreateEventUseCase } from '@/domain/events/application/use-cases/create-event'
import { DeleteEventUseCase } from '@/domain/events/application/use-cases/delete-event'
import { ListEventsUseCase } from '@/domain/events/application/use-cases/list-events'
import { UpdateEventUseCase } from '@/domain/events/application/use-cases/update-event'
import { normalizePaginationParams } from '@/domain/shared/pagination/pagination-utils'
import { JwtAuthGuard } from '@/infra/auth/jwt-auth.guard'
import { Roles } from '@/infra/auth/roles.decorator'
import { RolesGuard } from '@/infra/auth/roles.guard'
import { eventsListQuerySchema, type EventsListQuery } from '../queries/list-query-schemas'
import { ZodValidationPipe } from '../pipes/zod-validation-pipe'
import { EventRequestMapper } from '../mappers/event-request.mapper'
import { EventPresenter } from '../presenters/event.presenter'

@ApiTags('events')
@ApiBearerAuth('supabase-bearer')
@Controller('/api/events')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'teacher')
export class EventsController {
  constructor(
    private readonly listEvents: ListEventsUseCase,
    private readonly createEvent: CreateEventUseCase,
    private readonly updateEvent: UpdateEventUseCase,
    private readonly deleteEvent: DeleteEventUseCase,
  ) {}

  @Get()
  async index(@Query(new ZodValidationPipe(eventsListQuerySchema)) query: EventsListQuery) {
    const pagination = normalizePaginationParams({ page: query.page, perPage: query.perPage })
    const { events, meta } = await this.listEvents.execute({
      page: pagination.page,
      perPage: pagination.perPage,
      search: query.search,
      type: query.type,
      status: query.status,
    })
    return { data: events.map(EventPresenter.toHTTP), meta }
  }

  @Post()
  async create(@Body(new ZodValidationPipe(createEventSchema)) body: CreateEventDto) {
    const { event } = await this.createEvent.execute(EventRequestMapper.toCreate(body))
    return { data: EventPresenter.toHTTP(event) }
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body(new ZodValidationPipe(updateEventSchema)) body: UpdateEventDto) {
    const { event } = await this.updateEvent.execute(id, EventRequestMapper.toUpdate(body))
    return { data: EventPresenter.toHTTP(event) }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const { event } = await this.deleteEvent.execute(id)
    return { data: EventPresenter.toHTTP(event) }
  }
}
