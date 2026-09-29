import { ApiProperty } from '@nestjs/swagger';
import type { PaginationQueryDto } from './pagination-query.dto.js';

export class PaginationMetaDto {
  /** Total de registros que atendem ao filtro, ignorando a paginação. */
  total!: number;
  /** Pagina retornada. */
  page!: number;
  /** Tamanho da pagina usado na consulta. */
  limit!: number;
  /** Quantidade total de paginas. */
  totalPages!: number;
  hasNextPage!: boolean;
  hasPreviousPage!: boolean;
}

/**
 * Envelope de toda listagem da API.
 *
 * O tipo genérico é apagado na compilação, então o Swagger não consegue
 * descobrir sozinho o que vai em `data`: aqui ele fica como array genérico, e
 * o decorator `ApiPaginatedResponse` substitui pelo modelo concreto em cada
 * endpoint.
 */
export class PaginatedDto<T> {
  @ApiProperty({ type: 'array', items: { type: 'object' }, description: 'Itens da página' })
  data!: T[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}

/**
 * Monta a resposta paginada a partir dos itens da pagina e do total.
 * Centralizar aqui garante que toda listagem da API tenha o mesmo envelope.
 */
export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  query: Pick<PaginationQueryDto, 'page' | 'limit'>,
): PaginatedDto<T> {
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);

  return {
    data,
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages,
      hasNextPage: query.page < totalPages,
      hasPreviousPage: query.page > 1,
    },
  };
}
