import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ConfigService } from '@nestjs/config';
import type { Params } from 'nestjs-pino';
import type { AppConfig } from '../../config/configuration.js';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Configuracao do logger estruturado (pino).
 *
 * - Cada requisição ganha um id, reaproveitando o header `x-request-id` quando
 *   o cliente ou um proxy já enviou um. O mesmo id volta na resposta e aparece
 *   no corpo dos erros, o que permite casar log e incidente.
 * - Campos sensíveis são redigidos antes de chegar ao transporte.
 * - Em desenvolvimento a saída passa por `pino-pretty`; em produção sai em JSON
 *   puro, que é o que os coletores de log esperam.
 */
export const buildLoggerOptions = (config: ConfigService<AppConfig, true>): Params => {
  const isProduction = config.get('app.isProduction', { infer: true });
  const level = config.get('app.logLevel', { infer: true });

  return {
    pinoHttp: {
      level,
      genReqId: (req: IncomingMessage, res: ServerResponse) => {
        const fromHeader = req.headers[REQUEST_ID_HEADER];
        const id = (Array.isArray(fromHeader) ? fromHeader[0] : fromHeader) ?? randomUUID();
        res.setHeader(REQUEST_ID_HEADER, id);
        return id;
      },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.password',
          'req.body.currentPassword',
          'req.body.newPassword',
          'req.body.refreshToken',
          'res.headers["set-cookie"]',
        ],
        censor: '[redigido]',
      },
      customProps: (req) => ({ requestId: (req as IncomingMessage & { id?: string }).id }),
      autoLogging: {
        ignore: (req: IncomingMessage) =>
          req.url === '/health' || req.url?.endsWith('/health') === true,
      },
      transport: isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
              singleLine: true,
              colorize: true,
              translateTime: 'SYS:HH:MM:ss',
              ignore: 'pid,hostname,req,res',
              messageFormat: '{if requestId}[{requestId}] {end}{msg}',
            },
          },
    },
  };
};
