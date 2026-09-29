import { SetMetadata } from '@nestjs/common';
import type { Role } from '../../infra/prisma/prisma.client.js';

export const ROLES_KEY = 'roles';

/**
 * Restringe a rota aos papéis informados. Lido pelo RolesGuard.
 *
 * Uso: aplique o decorator `Roles('ADMIN')` acima do handler ou do controller
 * inteiro. Sem ele, qualquer usuário autenticado passa.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
