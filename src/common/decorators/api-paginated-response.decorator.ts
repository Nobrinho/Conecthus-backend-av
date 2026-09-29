import { Type, applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { PaginatedDto, PaginationMetaDto } from '../dto/paginated-result.dto.js';

/**
 * Documenta no Swagger uma resposta paginada de `model`.
 *
 * O `@nestjs/swagger` não consegue inferir sozinho o tipo genérico de
 * `PaginatedDto<T>`, então este decorator monta o schema combinando o envelope
 * com o `$ref` do modelo concreto.
 */
export const ApiPaginatedResponse = <TModel extends Type<unknown>>(
  model: TModel,
  description?: string,
) =>
  applyDecorators(
    ApiExtraModels(PaginatedDto, PaginationMetaDto, model),
    ApiOkResponse({
      description: description ?? `Lista paginada de ${model.name}`,
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginatedDto) },
          {
            properties: {
              data: { type: 'array', items: { $ref: getSchemaPath(model) } },
              meta: { $ref: getSchemaPath(PaginationMetaDto) },
            },
          },
        ],
      },
    }),
  );
