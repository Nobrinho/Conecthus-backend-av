/**
 * Corpo devolvido por qualquer erro da API. Padronizado pelo
 * AllExceptionsFilter para que o cliente nunca precise tratar dois formatos.
 */
export class ErrorResponseDto {
  /** Codigo HTTP repetido no corpo, útil em logs de cliente. */
  statusCode!: number;
  /** Mensagem legível, ou a lista de erros de validação. */
  message!: string | string[];
  /** Nome curto do erro, por exemplo `Bad Request`. */
  error!: string;
  /** Caminho que produziu o erro. */
  path!: string;
  /** Momento do erro em ISO 8601. */
  timestamp!: string;
  /** Campo que causou o erro, quando se aplica (ex.: `email` em um 409). */
  field?: string;
  /** Mesmo id do header `x-request-id`, para casar com a linha de log. */
  requestId?: string;
}
