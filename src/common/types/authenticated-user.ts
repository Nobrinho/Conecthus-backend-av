import type { Role } from '../../infra/prisma/prisma.client.js';

/**
 * Formato do `request.user` depois que a JwtAccessStrategy valida o token.
 * E o que o decorator @CurrentUser() devolve.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
}

/** Payload assinado dentro do access token. */
export interface AccessTokenPayload {
  /** subject: id do usuário */
  sub: string;
  email: string;
  role: Role;
}

/** Payload assinado dentro do refresh token. */
export interface RefreshTokenPayload {
  sub: string;
  /** id da linha em `refresh_tokens`, usado para rotacionar e revogar. */
  jti: string;
}
