import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Libera uma rota do JwtAuthGuard global.
 *
 * O guard de autenticação esta registrado como APP_GUARD, ou seja, tudo e
 * protegido por padrão. Marque com @Public() apenas o que deve ficar aberto.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
