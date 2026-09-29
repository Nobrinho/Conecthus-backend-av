import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../types/authenticated-user.js';

/**
 * Injeta o usuário autenticado no handler.
 *
 * Sem argumento devolve o objeto inteiro (`AuthenticatedUser`); com o nome de
 * um campo devolve só aquele campo, útil para receber apenas o `id`.
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      return undefined;
    }

    return field ? user[field] : user;
  },
);
