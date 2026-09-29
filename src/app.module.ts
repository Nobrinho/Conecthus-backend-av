import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import {
  CREDENTIALS_THROTTLER,
  CREDENTIAL_ROUTE_KEY,
} from './common/decorators/credential-rate-limit.decorator.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { configuration, type AppConfig } from './config/configuration.js';
import { buildLoggerOptions } from './infra/logger/logger.config.js';
import { HashModule } from './infra/hash/hash.module.js';
import { PrismaModule } from './infra/prisma/prisma.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard.js';
import { HealthModule } from './modules/health/health.module.js';
import { TasksModule } from './modules/tasks/tasks.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    // `configuration()` valida o ambiente com Zod; um .env incompleto derruba o
    // boot aqui, e não no meio de uma requisição.
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      // Os testes leem o .env.test, que aponta para o banco descartável e pode
      // ser versionado por não conter segredo de verdade.
      envFilePath: process.env['NODE_ENV'] === 'test' ? ['.env.test'] : ['.env'],
    }),

    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: buildLoggerOptions,
    }),

    ThrottlerModule.forRootAsync({
      // ConfigModule é global, mas o ThrottlerModule exige a chave `imports`.
      imports: [],
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.get('throttle.ttl', { infer: true }),
            limit: config.get('throttle.limit', { infer: true }),
          },
          {
            // Limite estrito aplicado só onde o decorator CredentialRateLimit
            // marcou a rota; nas demais, o skipIf desliga este limitador.
            name: CREDENTIALS_THROTTLER,
            ttl: config.get('throttle.credentialsTtl', { infer: true }),
            limit: config.get('throttle.credentialsLimit', { infer: true }),
            skipIf: (context) =>
              Reflect.getMetadata(CREDENTIAL_ROUTE_KEY, context.getHandler()) !== true,
          },
        ],
      }),
    }),

    PrismaModule,
    HashModule,

    AuthModule,
    UsersModule,
    TasksModule,
    HealthModule,
  ],
  providers: [
    // A ordem importa: os guards rodam nesta sequência.
    // O rate limit vem primeiro para que uma enxurrada de requisições seja
    // barrada antes de chegar à consulta de usuário feita pela autenticação.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
