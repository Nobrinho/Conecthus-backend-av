import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  /** E-mail cadastrado que receberá o link de redefinição. */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsNotEmpty({ message: 'Campo obrigatório' })
  @IsEmail({}, { message: 'Informe um e-mail válido' })
  @ApiProperty({ example: 'millena.souza@wenlock.com' })
  email!: string;
}
