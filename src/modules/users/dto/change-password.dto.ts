import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { PASSWORD_MESSAGE, PASSWORD_RULE } from './create-user.dto.js';

export class ChangePasswordDto {
  /** Senha atual, exigida mesmo quando o usuário já esta autenticado. */
  @IsString()
  @ApiProperty({ example: 'senhaAntiga1' })
  currentPassword!: string;

  @IsString()
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  @ApiProperty({ example: 'senhaNova1', minLength: 8 })
  newPassword!: string;
}
