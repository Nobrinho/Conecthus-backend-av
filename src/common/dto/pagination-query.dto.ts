import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * Query string de paginação compartilhada por todas as listagens.
 * Estenda esta classe no módulo para somar filtros próprios, como faz
 * `QueryTasksDto`.
 */
export class PaginationQueryDto {
  /** Pagina desejada, comecando em 1. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  /** Quantidade de itens por pagina. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit: number = DEFAULT_PAGE_SIZE;

  /** Ordenacao pela data de criacao. */
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';

  /** Quantos registros pular, derivado de `page` e `limit`. */
  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}
