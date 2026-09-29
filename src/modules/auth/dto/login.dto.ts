import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Informe um email válido' })
  @ApiProperty({ example: 'ana.silva@exemplo.com' })
  email!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'senhaSegura1' })
  password!: string;
}
