import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

/** Tamanhos oferecidos em "Itens por página"; o primeiro é o padrão. */
export const USERS_PAGE_SIZES = [10, 15, 50, 80, 100] as const;
export const USERS_PAGE_SIZE = USERS_PAGE_SIZES[0];

export class QueryUsersDto extends PaginationQueryDto {
  /** Busca parcial pelo nome, sem diferenciar maiúsculas. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(30)
  @ApiProperty({ required: false, example: 'adriano' })
  search?: string;

  /**
   * Itens por página: um dos tamanhos do seletor da lista. O padrão é 10 para
   * a lista caber na tela sem rolagem e a paginação ficar sempre visível.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn(USERS_PAGE_SIZES, {
    message: `limit deve ser um destes valores: ${USERS_PAGE_SIZES.join(', ')}`,
  })
  @ApiProperty({ required: false, default: USERS_PAGE_SIZE, enum: USERS_PAGE_SIZES })
  override limit: number = USERS_PAGE_SIZE;

  /** Ordem alfabética pelo nome. */
  @IsOptional()
  @IsIn(['asc', 'desc'])
  @ApiProperty({ required: false, enum: ['asc', 'desc'], default: 'asc' })
  override order: 'asc' | 'desc' = 'asc';
}
