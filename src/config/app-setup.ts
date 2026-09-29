import { ClassSerializerInterceptor, ValidationPipe, VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import helmet from 'helmet';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter.js';
import { TimeoutInterceptor } from '../common/interceptors/timeout.interceptor.js';
import type { AppConfig } from './configuration.js';

/**
 * Aplica na instância tudo que vale para a aplicação inteira: segurança,
 * prefixo, versionamento, validação, serialização e tratamento de erro.
 *
 * Vive em um arquivo próprio porque os testes e2e precisam exatamente da mesma
 * configuração do `main.ts`. Se a validação fosse montada só no bootstrap, os
 * testes passariam a exercitar uma aplicação diferente da que roda em produção.
 */
export function configureApp(app: INestApplication): ConfigService<AppConfig, true> {
  const config = app.get<ConfigService<AppConfig, true>>(ConfigService);

  app.use(
    helmet({
      // A UI do Swagger carrega scripts e estilos inline; sem esta abertura a
      // política padrão do helmet deixa a página de documentação em branco.
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'script-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'validator.swagger.io'],
        },
      },
    }),
  );

  app.enableCors({
    origin: config.get('app.corsOrigins', { infer: true }),
    credentials: true,
  });

  app.setGlobalPrefix(config.get('app.prefix', { infer: true }));
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      // `whitelist` remove campos não declarados no DTO e
      // `forbidNonWhitelisted` transforma o envio deles em 400, o que evita
      // que um cliente desatualizado grave lixo sem ninguém perceber.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector)),
    new TimeoutInterceptor(),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  // Faz o Nest aguardar o onModuleDestroy dos providers (o Prisma fecha o pool
  // aqui) antes de o processo terminar em um SIGTERM do orquestrador.
  app.enableShutdownHooks();

  return config;
}
