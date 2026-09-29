import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ErrorResponseDto } from '../dto/error-response.dto.js';
import { mapPrismaError } from './prisma-error.mapper.js';

interface HttpExceptionBody {
  message?: string | string[];
  error?: string;
}

/**
 * Único filtro global da aplicação.
 *
 * Converte qualquer exceção no envelope de erro documentado
 * (`ErrorResponseDto`), traduz erros do Prisma antes de decidir o status e
 * registra no log apenas o que realmente e falha do servidor. Erros 4xx são
 * esperados e não poluem o log de erro.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request & { id?: string }>();
    const response = ctx.getResponse<Response>();

    const httpException = this.toHttpException(exception);
    const status = httpException?.getStatus() ?? HttpStatus.INTERNAL_SERVER_ERROR;

    const body: ErrorResponseDto = {
      statusCode: status,
      message: this.extractMessage(httpException, status),
      error: this.extractErrorName(httpException, status),
      path: request.originalUrl ?? request.url,
      timestamp: new Date().toISOString(),
      requestId: request.id,
    };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${body.path} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.debug(`${request.method} ${body.path} -> ${status}: ${String(body.message)}`);
    }

    response.status(status).json(body);
  }

  private toHttpException(exception: unknown): HttpException | null {
    if (exception instanceof HttpException) {
      return exception;
    }
    return mapPrismaError(exception);
  }

  private extractMessage(exception: HttpException | null, status: number): string | string[] {
    if (!exception) {
      // Nunca vaze detalhes internos de um 500 para o cliente: eles ficam no log.
      return 'Erro interno do servidor';
    }

    const payload = exception.getResponse();

    if (typeof payload === 'string') {
      return payload;
    }

    const message = (payload as HttpExceptionBody).message;
    return message ?? exception.message ?? HttpStatus[status];
  }

  private extractErrorName(exception: HttpException | null, status: number): string {
    if (exception) {
      const payload = exception.getResponse();
      if (typeof payload === 'object' && (payload as HttpExceptionBody).error) {
        return (payload as HttpExceptionBody).error as string;
      }
    }
    return HttpStatus[status] ?? 'Internal Server Error';
  }
}
