import type { INestApplication } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { PaginationMetaDto } from '../common/dto/paginated-result.dto.js';
import type { AppConfig } from './configuration.js';

/**
 * Publica a documentação OpenAPI.
 *
 * A UI fica em `/<SWAGGER_PATH>` e o JSON puro em `/<SWAGGER_PATH>-json`, que é
 * o que ferramentas de geração de cliente consomem. Em produção a publicação
 * pode ser desligada por `SWAGGER_ENABLED=false`.
 *
 * As descrições dos endpoints vêm dos decorators `ApiOperation` e dos
 * comentários dos DTOs: o plugin do Swagger está ligado em `nest-cli.json` com
 * `introspectComments`, então cada campo documentado com JSDoc vira description
 * no schema sem precisar repetir a informação em `ApiProperty`.
 */
export function setupSwagger(
  app: INestApplication,
  config: ConfigService<AppConfig, true>,
): string | null {
  if (!config.get('swagger.enabled', { infer: true })) {
    return null;
  }

  const path = config.get('swagger.path', { infer: true });

  const documentConfig = new DocumentBuilder()
    .setTitle('WenLock API')
    .setDescription(
      [
        'API do WenLock: autenticação JWT, recuperação de senha e CRUD de usuários.',
        '',
        '**Como testar por aqui:**',
        '1. Chame `POST /auth/login` com `{ "login": "millena.souza@wenlock.com", "password": "abc123" }` (usuária do seed; o login também aceita a matrícula `100001`).',
        '2. Copie o `accessToken` da resposta.',
        '3. Clique em **Authorize** no topo da página e cole o token.',
        '',
        'O access token é curto. Quando expirar, use `POST /auth/refresh` com o `refreshToken`.',
        'Cada refresh invalida o token anterior, então guarde sempre o mais recente.',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Cole apenas o access token, sem o prefixo "Bearer".',
    })
    .addTag('auth', 'Login, renovação e encerramento de sessão, recuperação de senha')
    .addTag('users', 'Gestão de usuários')
    .addTag('health', 'Sonda de saúde para orquestradores')
    .build();

  const document = SwaggerModule.createDocument(app, documentConfig, {
    // Modelos que nenhum endpoint referencia diretamente, mas que aparecem nos
    // schemas compostos e no envelope de erro.
    extraModels: [ErrorResponseDto, PaginationMetaDto],
  });

  SwaggerModule.setup(path, app, document, {
    customSiteTitle: 'WenLock API',
    jsonDocumentUrl: `${path}-json`,
    swaggerOptions: {
      // Mantém o token entre recarregamentos da página.
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
      displayRequestDuration: true,
    },
  });

  return path;
}
