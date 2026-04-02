import { Controller, Get } from '@nestjs/common'

@Controller('health')
export class AppController {
  @Get()
  handle() {
    return {
      status: 'ok',
      service: 'swim-flow-nest-api',
      timestamp: new Date().toISOString(),
    }
  }
}
