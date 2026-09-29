import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import { Role } from '../../../infra/prisma/prisma.client.js';

export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
export const PASSWORD_MESSAGE =
  'A senha precisa ter no mínimo 8 caracteres, com ao menos uma letra e um número';

export class CreateUserDto {
  /** Email de login. Precisa ser único. */
  @IsEmail({}, { message: 'Informe um email válido' })
  @ApiProperty({ example: 'ana.silva@exemplo.com' })
  email!: string;

  /** Nome de exibicao. */
  @IsString()
  @Length(2, 120)
  @ApiProperty({ example: 'Ana Silva' })
  name!: string;

  /** Senha em texto puro. E convertida em hash argon2id antes de persistir. */
  @IsString()
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  @ApiProperty({ example: 'senhaSegura1', minLength: 8 })
  password!: string;

  /** Papel do usuário. Apenas administradores podem definir este campo. */
  @IsOptional()
  @IsEnum(Role)
  @ApiProperty({ enum: Role, enumName: 'Role', required: false, default: Role.USER })
  role?: Role;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ required: false, default: true })
  isActive?: boolean;
}
