import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import type { AppConfig } from '../../config/configuration.js';
import { PrismaClient } from './prisma.client.js';

/**
 * Prisma Client como provider do Nest.
 *
 * A partir do Prisma 7 a conexão passa por um driver adapter, então a string de
 * conexão vem do ConfigService e não de uma leitura solta de `process.env`.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService<AppConfig, true>) {
    super({
      adapter: new PrismaPg({
        connectionString: config.get('database.url', { infer: true }),
      }),
      log: ['warn', 'error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Conectado ao banco de dados');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Apaga todas as linhas das tabelas de domínio respeitando a ordem das FKs.
   * Usado pelos testes e2e entre suítes. Protegido para nunca rodar em produção.
   */
  async truncateAll(): Promise<void> {
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error('truncateAll() não pode ser chamado em produção');
    }

    await this.refreshToken.deleteMany();
    await this.task.deleteMany();
    await this.user.deleteMany();
  }
}
