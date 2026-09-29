import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { Role } from '../../infra/prisma/prisma.client.js';
import type { AuthenticatedUser } from '../types/authenticated-user.js';

/**
 * Autorizacao por papel. Roda depois do JwtAuthGuard, então pode assumir que
 * `request.user` existe sempre que a rota exigir um papel.
 *
 * Rotas sem o decorator `Roles` passam direto: proteger e responsabilidade do
 * guard de autenticação, não deste.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException(`Esta operação exige um dos papéis: ${required.join(', ')}`);
    }

    return true;
  }
}
