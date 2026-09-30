import { PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto.js';

/**
 * Atualização parcial: envie apenas o que mudou.
 *
 * A senha é opcional. Na tela de edição, deixá-la em branco mantém a senha
 * atual; quando enviada, segue a mesma regra do cadastro.
 */
export class UpdateUserDto extends PartialType(CreateUserDto) {}
