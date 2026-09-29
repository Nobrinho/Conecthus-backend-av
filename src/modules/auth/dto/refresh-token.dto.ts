import { ApiProperty } from '@nestjs/swagger';
import { IsJWT } from 'class-validator';

export class RefreshTokenDto {
  /** O `refreshToken` devolvido pelo login ou pela renovação anterior. */
  @IsJWT({ message: 'refreshToken precisa ser um JWT válido' })
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refreshToken!: string;
}
