import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { USER_RULES } from '../../users/user.rules.js';

export class ResetPasswordDto {
  /** Token recebido no link do e-mail de recuperação. */
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Qm9h...' })
  token!: string;

  /** Nova senha, com a mesma regra do cadastro. */
  @IsString()
  @Matches(USER_RULES.password.pattern, { message: USER_RULES.password.message })
  @ApiProperty({ example: 'xyz789', minLength: 6, maxLength: 6 })
  password!: string;
}
