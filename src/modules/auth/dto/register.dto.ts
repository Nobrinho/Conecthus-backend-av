import { OmitType } from '@nestjs/swagger';
import { CreateUserDto } from '../../users/dto/create-user.dto.js';

/**
 * Autocadastro. Herda as regras de validação de `CreateUserDto`, mas remove
 * `role` e `isActive`: quem se cadastra sozinho nunca escolhe o próprio papel.
 */
export class RegisterDto extends OmitType(CreateUserDto, ['role', 'isActive'] as const) {}
