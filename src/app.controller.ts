import {
  Controller,
  Get,
  Header,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '@/infra/database/prisma/prisma.service';

const serviceName = 'swim-flow-nest-api';

@Controller('health')
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liveness: the NestJS process is responding.
   * Keep this independent of Neon so Render can distinguish a running process
   * from a temporarily unavailable PostgreSQL database.
   */
  @Get()
  handle() {
    return {
      status: 'ok',
      service: serviceName,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness: a real PostgreSQL round trip, with no private schema reads,
   * data mutations or credential details exposed in the HTTP response.
   */
  @Get('ready')
  @Header('Cache-Control', 'no-store')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1 AS ok`;
      return {
        status: 'ready',
        service: serviceName,
        dependency: 'postgresql',
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'unavailable',
        service: serviceName,
        dependency: 'postgresql',
      });
    }
  }
}
