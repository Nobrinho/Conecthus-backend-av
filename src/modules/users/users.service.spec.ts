import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HashService } from '../../infra/hash/hash.service.js';
import { Role, type User } from '../../infra/prisma/prisma.client.js';
import { QueryUsersDto } from './dto/query-users.dto.js';
import type { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

const buildUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  name: 'Adriano Machado Souza',
  email: 'adriano@exemplo.com',
  registration: '809987',
  passwordHash: 'hash',
  role: Role.USER,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: null,
  ...overrides,
});

const input = {
  name: 'Adriano Machado Souza',
  email: 'adriano@exemplo.com',
  registration: '809987',
  password: 'abc123',
};

describe('UsersService', () => {
  let repository: Record<string, ReturnType<typeof vi.fn>>;
  let service: UsersService;

  beforeEach(() => {
    repository = {
      create: vi.fn().mockResolvedValue(buildUser()),
      findById: vi.fn().mockResolvedValue(buildUser()),
      findByEmail: vi.fn().mockResolvedValue(null),
      findByRegistration: vi.fn().mockResolvedValue(null),
      findManyPaginated: vi.fn().mockResolvedValue([[buildUser()], 1]),
      update: vi.fn().mockResolvedValue(buildUser({ updatedAt: new Date() })),
      delete: vi.fn().mockResolvedValue(buildUser()),
    };
    const hash = { hash: vi.fn().mockResolvedValue('novo-hash') };

    service = new UsersService(
      repository as unknown as UsersRepository,
      hash as unknown as HashService,
    );
  });

  describe('create', () => {
    it('grava o hash da senha e nunca devolve o hash', async () => {
      const result = await service.create(input);

      expect(repository['create']).toHaveBeenCalledWith(
        expect.objectContaining({ passwordHash: 'novo-hash', registration: '809987' }),
      );
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('password');
    });

    it.each([
      ['email', 'findByEmail'],
      ['registration', 'findByRegistration'],
    ])('recusa %s duplicado indicando o campo', async (field, lookup) => {
      repository[lookup]!.mockResolvedValue(buildUser({ id: 'outro' }));

      const error = await service.create(input).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({ field });
      expect(repository['create']).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('filtra só pelo nome e monta o envelope paginado', async () => {
      const query = Object.assign(new QueryUsersDto(), { search: 'adri', page: 2 });
      repository['findManyPaginated']!.mockResolvedValue([[buildUser()], 16]);

      const result = await service.findAll(query);

      expect(repository['findManyPaginated']).toHaveBeenCalledWith({
        where: { name: { contains: 'adri', mode: 'insensitive' } },
        skip: 15,
        take: 15,
        order: 'asc',
      });
      expect(result.meta).toMatchObject({ total: 16, page: 2, limit: 15, totalPages: 2 });
    });
  });

  describe('update', () => {
    it('mantém a senha quando ela não é enviada e marca a data de edição', async () => {
      await service.update('user-1', { name: 'Adriano Souza' });

      const data = repository['update']!.mock.calls[0]![1];
      expect(data).not.toHaveProperty('passwordHash');
      expect(data.name).toBe('Adriano Souza');
      expect(data.updatedAt).toBeInstanceOf(Date);
    });

    it('permite manter o próprio e-mail e matrícula', async () => {
      repository['findByEmail']!.mockResolvedValue(buildUser());
      repository['findByRegistration']!.mockResolvedValue(buildUser());

      await expect(service.update('user-1', input)).resolves.toBeDefined();
    });

    it('recusa usuário inexistente', async () => {
      repository['findById']!.mockResolvedValue(null);

      await expect(service.update('x', { name: 'Ana' })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('recusa usuário inexistente', async () => {
      repository['findById']!.mockResolvedValue(null);

      await expect(service.remove('x', 'ator')).rejects.toBeInstanceOf(NotFoundException);
      expect(repository['delete']).not.toHaveBeenCalled();
    });

    it('recusa excluir o próprio usuário', async () => {
      await expect(service.remove('eu', 'eu')).rejects.toBeInstanceOf(ForbiddenException);
      expect(repository['findById']).not.toHaveBeenCalled();
      expect(repository['delete']).not.toHaveBeenCalled();
    });
  });
});
