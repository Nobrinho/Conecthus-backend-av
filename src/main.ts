import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { configureApp } from './config/app-setup.js';
import { setupSwagger } from './config/swagger.config.js';

async function bootstrap(): Promise<void> {
  // `bufferLogs` segura as mensagens do boot até o logger do pino estar pronto,
  // para que nenhuma linha saia no formato padrão do Nest.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(Logger);

  app.useLogger(logger);

  const config = configureApp(app);
  const docsPath = setupSwagger(app, config);
  const port = config.get('app.port', { infer: true });
  const prefix = config.get('app.prefix', { infer: true });

  await app.listen(port);

  logger.log(`API em http://localhost:${port}/${prefix}/v1`);
  if (docsPath) {
    logger.log(`Documentação em http://localhost:${port}/${docsPath}`);
  }
}

await bootstrap();
