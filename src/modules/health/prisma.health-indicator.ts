import { Injectable } from '@nestjs/common';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';
import { PrismaService } from '../../infra/prisma/prisma.service.js';

const DB_CHECK_TIMEOUT_MS = 3_000;

/**
 * Checa o banco com o menor round-trip possível (`SELECT 1`).
 *
 * Se esta consulta falha ou trava, a instância não tem como atender requisição
 * alguma, e o orquestrador deve tirá-la do balanceador. O timeout é o que
 * transforma um banco lento em uma resposta rápida de `down`, em vez de deixar
 * o próprio health check pendurado.
 */
@Injectable()
export class PrismaHealthIndicator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  isHealthy(key: string): PromiseLike<HealthIndicatorResult> {
    return this.healthIndicatorService
      .check(key)
      .attempt(async () => {
        await this.prisma.$queryRaw`SELECT 1`;
      })
      .withTimeout(DB_CHECK_TIMEOUT_MS);
  }
}
