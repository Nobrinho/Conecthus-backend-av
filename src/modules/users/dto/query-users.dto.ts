import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { Role } from '../../../infra/prisma/prisma.client.js';

export class QueryUsersDto extends PaginationQueryDto {
  /** Busca parcial e sem diferenciar maiusculas em nome e email. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @ApiProperty({ required: false, example: 'ana' })
  search?: string;

  @IsOptional()
  @IsEnum(Role)
  @ApiProperty({ enum: Role, enumName: 'Role', required: false })
  role?: Role;

  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  @ApiProperty({ required: false })
  isActive?: boolean;
}
