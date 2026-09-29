import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto.js';

/**
 * Atualizacao parcial. A senha fica de fora de propósito: trocar senha e um
 * fluxo próprio (`PATCH /users/:id/password`) porque exige a senha atual.
 */
export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['password'] as const)) {}
