import type { User } from '../../../infra/prisma/prisma.client.js';

/**
 * Projeção pública de um usuário.
 *
 * A entidade do Prisma carrega `passwordHash`; esta classe existe justamente
 * para que esse campo nunca alcance a resposta HTTP. Toda rota que devolve
 * usuário passa por `fromEntity`.
 */
export class UserResponseDto {
  /** Identificador do usuário (UUID v4). */
  id!: string;

  /** Nome completo. */
  name!: string;

  /** Email de login, único. */
  email!: string;

  /** Matrícula, única. */
  registration!: string;

  /** Data de criação do cadastro. */
  createdAt!: Date;

  /** Data da última edição. `null` quando o cadastro nunca foi editado. */
  updatedAt!: Date | null;

  static fromEntity(user: User): UserResponseDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      registration: user.registration,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
