import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { buildPaginatedResult, type PaginatedDto } from '../../common/dto/paginated-result.dto.js';
import { HashService } from '../../infra/hash/hash.service.js';
import type { Prisma, User } from '../../infra/prisma/prisma.client.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { QueryUsersDto } from './dto/query-users.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import { UsersRepository } from './users.repository.js';

type UniqueField = 'email' | 'registration';

const CONFLICT_MESSAGES: Record<UniqueField, string> = {
  email: 'Já existe um usuário com este e-mail',
  registration: 'Já existe um usuário com esta matrícula',
};

@Injectable()
export class UsersService {
  constructor(
    private readonly repository: UsersRepository,
    private readonly hash: HashService,
  ) {}

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    await this.assertUnique(dto);

    const user = await this.repository.create({
      name: dto.name,
      email: dto.email,
      registration: dto.registration,
      passwordHash: await this.hash.hash(dto.password),
    });

    return UserResponseDto.fromEntity(user);
  }

  async findAll(query: QueryUsersDto): Promise<PaginatedDto<UserResponseDto>> {
    const where: Prisma.UserWhereInput = query.search
      ? { name: { contains: query.search, mode: 'insensitive' } }
      : {};

    const [users, total] = await this.repository.findManyPaginated({
      where,
      skip: query.skip,
      take: query.limit,
      order: query.order,
    });

    return buildPaginatedResult(users.map(UserResponseDto.fromEntity), total, query);
  }

  async findOne(id: string): Promise<UserResponseDto> {
    return UserResponseDto.fromEntity(await this.findEntityOrFail(id));
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    await this.findEntityOrFail(id);
    await this.assertUnique(dto, id);

    const user = await this.repository.update(id, {
      ...(dto.name === undefined ? {} : { name: dto.name }),
      ...(dto.email === undefined ? {} : { email: dto.email }),
      ...(dto.registration === undefined ? {} : { registration: dto.registration }),
      ...(dto.password === undefined ? {} : { passwordHash: await this.hash.hash(dto.password) }),
      updatedAt: new Date(),
    });

    return UserResponseDto.fromEntity(user);
  }

  async remove(id: string): Promise<void> {
    await this.findEntityOrFail(id);
    await this.repository.delete(id);
  }

  /**
   * Devolvem a entidade crua, com `passwordHash`. Existem para o AuthService e
   * para as estratégias do Passport; controllers nunca devem usá-las.
   */
  findEntityByEmail(email: string): Promise<User | null> {
    return this.repository.findByEmail(email);
  }

  findEntityByRegistration(registration: string): Promise<User | null> {
    return this.repository.findByRegistration(registration);
  }

  findEntityById(id: string): Promise<User | null> {
    return this.repository.findById(id);
  }

  async updatePassword(id: string, password: string): Promise<void> {
    await this.repository.update(id, { passwordHash: await this.hash.hash(password) });
  }

  private async findEntityOrFail(id: string): Promise<User> {
    const user = await this.repository.findById(id);

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return user;
  }

  /**
   * Checa email e matrícula antes de gravar para devolver um 409 que diz qual
   * campo conflita, e assim o formulário marca o campo certo. A constraint
   * unique do banco continua sendo a garantia final contra corridas; nesse
   * caso raro o `prisma-error.mapper` também devolve 409 com o campo.
   */
  private async assertUnique(
    data: Partial<Pick<CreateUserDto, UniqueField>>,
    ignoreId?: string,
  ): Promise<void> {
    const checks: [UniqueField, Promise<User | null> | null][] = [
      ['email', data.email ? this.repository.findByEmail(data.email) : null],
      [
        'registration',
        data.registration ? this.repository.findByRegistration(data.registration) : null,
      ],
    ];

    for (const [field, lookup] of checks) {
      const existing = await lookup;
      if (existing && existing.id !== ignoreId) {
        throw new ConflictException({
          message: CONFLICT_MESSAGES[field],
          error: 'Conflict',
          field,
        });
      }
    }
  }
}
