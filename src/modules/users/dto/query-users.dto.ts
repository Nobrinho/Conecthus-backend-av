import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min, MaxLength } from 'class-validator';
import { MAX_PAGE_SIZE, PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

export const USERS_PAGE_SIZE = 15;

export class QueryUsersDto extends PaginationQueryDto {
  /** Busca parcial pelo nome, sem diferenciar maiúsculas. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(30)
  @ApiProperty({ required: false, example: 'adriano' })
  search?: string;

  /** Itens por página. O protótipo usa 15. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  @ApiProperty({ required: false, default: USERS_PAGE_SIZE, maximum: MAX_PAGE_SIZE })
  override limit: number = USERS_PAGE_SIZE;

  /** Ordem alfabética pelo nome. */
  @IsOptional()
  @IsIn(['asc', 'desc'])
  @ApiProperty({ required: false, enum: ['asc', 'desc'], default: 'asc' })
  override order: 'asc' | 'desc' = 'asc';
}
