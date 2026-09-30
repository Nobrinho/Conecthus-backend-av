import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { Prisma, type User } from '../../infra/prisma/prisma.client.js';

/**
 * Único ponto do módulo que conhece o Prisma.
 *
 * Manter o acesso a dados aqui deixa o service testável com um mock pequeno e
 * permite trocar a persistencia sem reescrever regra de negocio.
 */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  findByRegistration(registration: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { registration } });
  }

  /** Devolve a pagina e o total em uma única transacao, para que a contagem
   * corresponda exatamente ao mesmo instante dos dados retornados. */
  findManyPaginated(params: {
    where: Prisma.UserWhereInput;
    skip: number;
    take: number;
    order: Prisma.SortOrder;
  }): Promise<[User[], number]> {
    const { where, skip, take, order } = params;

    return this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        // `id` desempata nomes iguais para que a paginação seja estável.
        orderBy: [{ name: order }, { id: 'asc' }],
      }),
      this.prisma.user.count({ where }),
    ]);
  }

  update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  delete(id: string): Promise<User> {
    return this.prisma.user.delete({ where: { id } });
  }
}
