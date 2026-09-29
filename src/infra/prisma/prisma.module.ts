import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

/**
 * Global para que nenhum módulo de domínio precise importar PrismaModule
 * explicitamente: basta injetar PrismaService no repositorio.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
