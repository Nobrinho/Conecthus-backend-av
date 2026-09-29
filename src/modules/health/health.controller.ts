import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  type HealthCheckResult,
} from '@nestjs/terminus';
import { ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { PrismaHealthIndicator } from './prisma.health-indicator.js';

const HEAP_LIMIT_BYTES = 512 * 1024 * 1024;

@ApiTags('health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: PrismaHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Estado da aplicação e das dependências',
    description:
      'Aponte o liveness e o readiness probe do orquestrador para cá. Responde 503 quando alguma checagem falha.',
  })
  @ApiServiceUnavailableResponse({ description: 'Alguma dependência está indisponível' })
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.database.isHealthy('database'),
      () => this.memory.checkHeap('memory_heap', HEAP_LIMIT_BYTES),
    ]);
  }
}
