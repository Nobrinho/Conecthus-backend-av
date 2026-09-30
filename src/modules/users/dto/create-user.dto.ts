import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Length, Matches, MaxLength } from 'class-validator';
import { USER_RULES } from '../user.rules.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateUserDto {
  /** Nome completo. Apenas letras e espaços. */
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'O nome é obrigatório' })
  @MaxLength(USER_RULES.name.maxLength, {
    message: `O nome deve ter no máximo ${USER_RULES.name.maxLength} caracteres`,
  })
  @Matches(USER_RULES.name.pattern, { message: USER_RULES.name.message })
  @ApiProperty({ example: 'Adriano Machado Souza', maxLength: USER_RULES.name.maxLength })
  name!: string;

  /** Email de login. Único e armazenado em minúsculas. */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsNotEmpty({ message: 'O e-mail é obrigatório' })
  @MaxLength(USER_RULES.email.maxLength, {
    message: `O e-mail deve ter no máximo ${USER_RULES.email.maxLength} caracteres`,
  })
  @IsEmail({}, { message: 'Informe um e-mail válido' })
  @ApiProperty({
    example: 'adriano.machado@callidus.com.br',
    maxLength: USER_RULES.email.maxLength,
  })
  email!: string;

  /** Matrícula. Apenas números, única. */
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'A matrícula é obrigatória' })
  @Length(USER_RULES.registration.minLength, USER_RULES.registration.maxLength, {
    message: `A matrícula deve ter entre ${USER_RULES.registration.minLength} e ${USER_RULES.registration.maxLength} dígitos`,
  })
  @Matches(USER_RULES.registration.pattern, { message: USER_RULES.registration.message })
  @ApiProperty({
    example: '809987',
    minLength: USER_RULES.registration.minLength,
    maxLength: USER_RULES.registration.maxLength,
  })
  registration!: string;

  /** Senha em texto puro. Convertida em hash argon2id antes de persistir. */
  @IsString()
  @IsNotEmpty({ message: 'A senha é obrigatória' })
  @Matches(USER_RULES.password.pattern, { message: USER_RULES.password.message })
  @ApiProperty({ example: 'abc123', minLength: 6, maxLength: 6 })
  password!: string;
}
