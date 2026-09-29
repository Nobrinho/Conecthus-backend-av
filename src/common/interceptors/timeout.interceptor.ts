import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, TimeoutError, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

export const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Corta requisições que passam do tempo limite, devolvendo 408 em vez de
 * deixar a conexão pendurada quando uma dependencia externa trava.
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly milliseconds: number = DEFAULT_TIMEOUT_MS) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      timeout(this.milliseconds),
      catchError((error: unknown) =>
        throwError(() =>
          error instanceof TimeoutError
            ? new RequestTimeoutException('A requisição excedeu o tempo limite')
            : error,
        ),
      ),
    );
  }
}
