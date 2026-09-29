import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator.js';
import { JWT_ACCESS_STRATEGY } from '../strategies/jwt-access.strategy.js';

/**
 * Guard de autenticação registrado como APP_GUARD.
 *
 * A escolha é fechar por padrão: toda rota exige um access token válido, e
 * abrir uma rota é um ato explícito com o decorator `Public`. O caminho
 * contrário, abrir por padrão, transforma qualquer esquecimento em vazamento.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard(JWT_ACCESS_STRATEGY) {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser>(err: unknown, user: TUser, info: unknown): TUser {
    if (err || !user) {
      const reason = info instanceof Error ? info.message : 'token ausente ou inválido';
      throw err instanceof Error ? err : new UnauthorizedException(`Não autenticado: ${reason}`);
    }

    return user;
  }
}
