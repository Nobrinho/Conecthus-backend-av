import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../infra/prisma/prisma.client.js';

/**
 * Traduz erros conhecidos do Prisma para HttpException.
 *
 * Sem isso, uma violacao de unique vira 500 e o cliente não consegue
 * diferenciar "email já cadastrado" de "o servidor caiu". Devolve `null`
 * quando o erro não e do Prisma ou não tem traducao obvia, para que o
 * AllExceptionsFilter trate como 500.
 *
 * Codigos: https://www.prisma.io/docs/orm/reference/error-reference
 */
export function mapPrismaError(exception: unknown): HttpException | null {
  if (!(exception instanceof Prisma.PrismaClientKnownRequestError)) {
    return null;
  }

  switch (exception.code) {
    case 'P2002': {
      const target = exception.meta?.['target'];
      const fields = Array.isArray(target) ? target.map(String) : [String(target ?? 'campo')];
      return new ConflictException({
        message: `Já existe um registro com o mesmo valor em: ${fields.join(', ')}`,
        error: 'Conflict',
        field: fields[0],
      });
    }
    case 'P2025':
      return new NotFoundException('Registro não encontrado');
    case 'P2003':
      return new BadRequestException('Referencia inválida: o registro relacionado não existe');
    case 'P2014':
      return new BadRequestException('A operação viola uma relação obrigatória entre os registros');
    default:
      return null;
  }
}
