import { ApiProperty } from '@nestjs/swagger';
import { Role, type User } from '../../../infra/prisma/prisma.client.js';

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

  /** Email de login, único. */
  email!: string;

  /** Nome de exibicao. */
  name!: string;

  @ApiProperty({ enum: Role, enumName: 'Role' })
  role!: Role;

  /** Usuarios inativos não conseguem autenticar. */
  isActive!: boolean;

  createdAt!: Date;
  updatedAt!: Date;

  static fromEntity(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
