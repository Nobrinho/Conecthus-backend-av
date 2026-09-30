import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  /** E-mail ou matrícula. O campo "Usuário" do protótipo aceita os dois. */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Campo obrigatório' })
  @ApiProperty({ example: 'millena.souza@wenlock.com' })
  login!: string;

  @IsString()
  @IsNotEmpty({ message: 'Campo obrigatório' })
  @ApiProperty({ example: 'abc123' })
  password!: string;
}
