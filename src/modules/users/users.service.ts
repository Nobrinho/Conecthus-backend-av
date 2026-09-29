import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { buildPaginatedResult, type PaginatedDto } from '../../common/dto/paginated-result.dto.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';
import { Prisma, Role, type User } from '../../infra/prisma/prisma.client.js';
import { HashService } from '../../infra/hash/hash.service.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { QueryUsersDto } from './dto/query-users.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import { UsersRepository } from './users.repository.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly repository: UsersRepository,
    private readonly hash: HashService,
  ) {}

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.repository.create({
      email: dto.email.toLowerCase(),
      name: dto.name,
      passwordHash: await this.hash.hash(dto.password),
      role: dto.role ?? Role.USER,
      isActive: dto.isActive ?? true,
    });

    return UserResponseDto.fromEntity(user);
  }

  async findAll(query: QueryUsersDto): Promise<PaginatedDto<UserResponseDto>> {
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [users, total] = await this.repository.findManyPaginated({
      where,
      skip: query.skip,
      take: query.limit,
      order: query.order,
    });

    return buildPaginatedResult(users.map(UserResponseDto.fromEntity), total, query);
  }

  async findOne(id: string, actor: AuthenticatedUser): Promise<UserResponseDto> {
    this.assertCanManage(id, actor);
    return UserResponseDto.fromEntity(await this.findEntityOrFail(id));
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthenticatedUser): Promise<UserResponseDto> {
    this.assertCanManage(id, actor);

    // Só um administrador muda papel ou status de conta; do contrário qualquer
    // usuário poderia se promover editando o próprio cadastro.
    if ((dto.role !== undefined || dto.isActive !== undefined) && actor.role !== Role.ADMIN) {
      throw new ForbiddenException('Apenas administradores podem alterar papel ou status');
    }

    await this.findEntityOrFail(id);

    const user = await this.repository.update(id, {
      ...(dto.email === undefined ? {} : { email: dto.email.toLowerCase() }),
      ...(dto.name === undefined ? {} : { name: dto.name }),
      ...(dto.role === undefined ? {} : { role: dto.role }),
      ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
    });

    return UserResponseDto.fromEntity(user);
  }

  async changePassword(
    id: string,
    dto: ChangePasswordDto,
    actor: AuthenticatedUser,
  ): Promise<void> {
    if (id !== actor.id) {
      throw new ForbiddenException('Voce só pode alterar a própria senha');
    }

    const user = await this.findEntityOrFail(id);

    if (!(await this.hash.verify(user.passwordHash, dto.currentPassword))) {
      throw new ForbiddenException('Senha atual incorreta');
    }

    await this.repository.update(id, { passwordHash: await this.hash.hash(dto.newPassword) });
  }

  async remove(id: string): Promise<void> {
    await this.findEntityOrFail(id);
    await this.repository.delete(id);
  }

  /**
   * Devolve a entidade crua, com `passwordHash`. Existe para o AuthService e
   * para as estratégias do Passport; controllers nunca devem usá-la.
   */
  findEntityByEmail(email: string): Promise<User | null> {
    return this.repository.findByEmail(email);
  }

  findEntityById(id: string): Promise<User | null> {
    return this.repository.findById(id);
  }

  private async findEntityOrFail(id: string): Promise<User> {
    const user = await this.repository.findById(id);

    if (!user) {
      throw new NotFoundException(`Usuario ${id} não encontrado`);
    }

    return user;
  }

  private assertCanManage(targetId: string, actor: AuthenticatedUser): void {
    if (actor.role !== Role.ADMIN && actor.id !== targetId) {
      throw new ForbiddenException('Voce só pode acessar o próprio cadastro');
    }
  }
}
